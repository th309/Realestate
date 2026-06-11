"""End-to-end discovery: pick features, validate, write report.

CLI:
  python -m scripts.analysis.v2.discover --geo-level metro
  python -m scripts.analysis.v2.discover --geo-level county
  python -m scripts.analysis.v2.discover --geo-level zip
  python -m scripts.analysis.v2.discover --geo-level state

Path A: reads pre-dumped Parquet panels from --data-dir. Does NOT connect
to the DB. The dump coordinator (a separate step) is responsible for
producing the Parquet files via MCP queries.
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd

from scripts.analysis.v2.peer_cascade import build_peer_index
from scripts.analysis.v2.target_builder import compute_forward_returns, compute_excess
from scripts.analysis.v2.feature_loader import load_feature_panel
from scripts.analysis.v2.feature_ranker import rank_features
from scripts.analysis.v2.forward_add import forward_add_with_ci_gate, ForwardAddResult, StrictBar
from scripts.analysis.v2.validation import year_by_year_ic, permutation_significance, passes_battery

GeoLevel = Literal["metro", "county", "zip", "state"]
DEFAULT_DATA_DIR = Path(__file__).parent / "data"
DEFAULT_OUTPUT_DIR = Path(__file__).parents[3] / "docs" / "superpowers" / "results"

# Cascade thresholds — TODO: lock via Task 6 threshold sweep
DEFAULT_THRESHOLDS = {"n_state": 10, "n_division": 20, "n_region": 40}

STRICT_BAR = StrictBar(ic_min=0.15, hit_min=0.60, spread_min=0.04, mono_freq_min=0.95, k_max=12)
RELAXED_BAR = StrictBar(ic_min=0.10, hit_min=0.55, spread_min=0.02, mono_freq_min=0.0, k_max=6)


def _load_zhvi(data_dir: Path, geo_level: GeoLevel) -> pd.DataFrame:
    path = data_dir / f"zillow_{geo_level}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"{path} missing — run the dump coordinator")
    df = pd.read_parquet(path)
    # Some dumps may store wide (zil_zhvi column) or long (metric_name+value). Handle both.
    if "zil_zhvi" in df.columns:
        out = df[["region_id", "period_date", "zil_zhvi"]].rename(columns={"zil_zhvi": "zhvi"})
    elif "metric_name" in df.columns:
        out = df[df["metric_name"] == "zhvi"][["region_id", "period_date", "value"]].rename(columns={"value": "zhvi"})
    else:
        raise ValueError(f"{path} has neither zil_zhvi nor metric_name; cannot extract ZHVI")
    out["period_date"] = pd.to_datetime(out["period_date"])
    return out.dropna(subset=["zhvi"])


def _load_geos(data_dir: Path, geo_level: GeoLevel) -> pd.DataFrame:
    path = data_dir / f"geos_{geo_level}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"{path} missing — run the dump coordinator")
    df = pd.read_parquet(path)
    required = {"region_id", "state_abbrev", "division", "region"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{path} missing columns: {missing}")
    return df


def discover(geo_level: GeoLevel, *, data_dir: Path, output_dir: Path, n_bootstrap: int = 1000) -> dict:
    """Run full discovery for one geo level. Writes a markdown report."""
    bar = RELAXED_BAR if geo_level == "state" else STRICT_BAR
    bar_name = "RELAXED" if geo_level == "state" else "STRICT"
    print(f"=== Discovery for {geo_level} (bar: {bar_name}) ===")

    # 1. ZHVI + forward returns
    zhvi = _load_zhvi(data_dir, geo_level)
    print(f"ZHVI: {len(zhvi):,} rows, {zhvi['region_id'].nunique()} regions")
    fr = compute_forward_returns(zhvi, horizon_months=36)
    print(f"Forward returns: {len(fr):,} rows")

    if len(fr) == 0:
        # Cannot build peer index or excess without any forward-return rows.
        # This fires when the ZHVI panel spans fewer than 36 months.
        geos = _load_geos(data_dir, geo_level)  # still validate the file exists
        empty_joined = zhvi[[]].assign(peer_tier=pd.Series(dtype=int))
        return _write_report(
            geo_level, output_dir, bar, bar_name, empty_joined, None, None, None, None,
            error=f"Panel too small ({len(zhvi)} ZHVI rows, 0 forward returns) — discovery aborted",
        )

    # 2. Cascade peer index
    geos = _load_geos(data_dir, geo_level)
    # Expand geos to one row per (region, period_date) so build_peer_index sees per-period membership
    periods = fr["period_date"].unique()
    full_geos = (
        geos[["region_id", "state_abbrev", "division", "region"]]
        .merge(pd.DataFrame({"period_date": periods}), how="cross")
    )
    idx = build_peer_index(full_geos, **DEFAULT_THRESHOLDS)
    print(f"Peer index built with thresholds {DEFAULT_THRESHOLDS}")

    # 3. Excess returns
    ex = compute_excess(fr, idx, horizon_months=36)
    ex = ex.dropna(subset=["excess_3y"])
    print(f"Excess: {len(ex):,} rows. Tier distribution: {ex['peer_tier'].value_counts().to_dict()}")

    # 4. Feature panel
    try:
        fp = load_feature_panel(geo_level, data_dir=data_dir)
        print(f"Feature panel: {len(fp.df):,} rows × {len(fp.feature_cols)} candidates")
    except FileNotFoundError:
        # No feature source files available — treat as empty panel so the
        # small-panel abort fires with a clear message rather than an
        # unhandled exception during a smoke test or early-stage run.
        print("No feature source files found; continuing with empty feature panel")
        fp_df = ex[["region_id", "period_date"]].copy()
        fp = type("FeaturePanel", (), {"df": fp_df, "feature_cols": []})()

    # 5. Join excess + features on (region_id, period_date)
    ex["period_month"] = ex["period_date"].dt.to_period("M")
    fp.df["period_month"] = fp.df["period_date"].dt.to_period("M")
    joined = ex.merge(
        fp.df[["region_id", "period_month"] + fp.feature_cols],
        on=["region_id", "period_month"], how="inner",
    )
    joined["year"] = joined["period_date"].dt.year
    print(f"Joined (pre-window-filter): {len(joined):,} rows")

    # Restrict to the feature window. ZHVI extends back to 2000 but RFDC starts
    # 2012-2019; pre-2012 rows have only Census filled in, which makes every
    # RFDC feature look ~50%+ null in the joined panel even though it's fully
    # populated post-2012. Cut to 2012-01-01 so coverage is honest.
    FEATURE_WINDOW_START = pd.Timestamp("2012-01-01")
    joined = joined[joined["period_date"] >= FEATURE_WINDOW_START].copy()
    print(f"Joined (post-{FEATURE_WINDOW_START.date()}): {len(joined):,} rows")

    if len(joined) < 1000:
        return _write_report(
            geo_level, output_dir, bar, bar_name, joined, None, None, None, None,
            error=f"Panel too small ({len(joined)}) — discovery aborted",
        )

    # 6. Filter features by coverage (≥30% non-null); median-impute the rest.
    # 30% threshold accommodates dashboards with later starts (e.g. RFDC
    # investors begins ~2019). Below this we'd be imputing more than we observe.
    COVERAGE_THRESHOLD = 0.30
    usable = [c for c in fp.feature_cols if joined[c].notna().mean() >= COVERAGE_THRESHOLD]
    print(f"Usable features (>={int(COVERAGE_THRESHOLD * 100)}% coverage): {len(usable)} / {len(fp.feature_cols)}")
    for c in usable:
        joined[c] = joined[c].fillna(joined[c].median())

    if not usable:
        return _write_report(
            geo_level, output_dir, bar, bar_name, joined, None, None, None, idx,
            error="No usable features after coverage filter — discovery aborted",
        )

    # 7. SHAP ranking
    ranking = rank_features(joined, target_col="excess_3y", feature_cols=usable, year_col="year")
    print("Top 10 by SHAP:")
    print(ranking.head(10).to_string(index=False))

    # 8. Forward-add bootstrap CI gate
    result = forward_add_with_ci_gate(
        joined, target_col="excess_3y",
        ranked_features=ranking["feature"].tolist(),
        bar=bar, year_col="year", n_bootstrap=n_bootstrap,
    )
    print(f"K = {result.k}, shipped = {result.shipped}")

    # 9. Validation battery (only if forward-add shipped)
    battery_result = None
    if result.shipped:
        means = np.array([result.feature_means[f] for f in result.selected])
        stds = np.array([result.feature_stdevs[f] for f in result.selected])
        weights = np.array([result.ridge_weights[f] for f in result.selected])
        Z = (joined[result.selected].values - means) / stds
        joined["v2_score_raw"] = Z @ weights

        yby = year_by_year_ic(joined, score_col="v2_score_raw", target_col="excess_3y", year_col="year")
        perm = permutation_significance(joined["v2_score_raw"].values, joined["excess_3y"].values, n_shuffles=5000)
        passed, reason = passes_battery(yby, perm, year_pct_min=0.80, sigma_min=3.0)
        battery_result = {"yby": yby, "perm": perm, "passed": passed, "reason": reason}

        if not passed:
            print(f"Battery FAILED: {reason} — downgrading result to NOT SHIPPED")
            result = ForwardAddResult(
                selected=result.selected, k=0, shipped=False,
                last_bootstrap=result.last_bootstrap, ridge_alpha=result.ridge_alpha,
                feature_means={}, feature_stdevs={}, ridge_weights={},
            )

    return _write_report(geo_level, output_dir, bar, bar_name, joined, ranking, result, battery_result, idx)


def _write_report(
    geo_level: GeoLevel,
    output_dir: Path,
    bar: StrictBar,
    bar_name: str,
    joined: pd.DataFrame,
    ranking,
    result,
    battery,
    idx,
    error: str | None = None,
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()
    out_path = output_dir / f"{today}-{geo_level}-discovery.md"

    with open(out_path, "w") as f:
        f.write(f"# {geo_level.capitalize()} discovery results\n\n")
        f.write(f"**Run date:** {today}\n")
        f.write(f"**Bar:** {bar_name} ({json.dumps(bar.__dict__)})\n")
        f.write(f"**Cascade thresholds:** {DEFAULT_THRESHOLDS}\n")
        f.write(f"**Panel size:** {len(joined):,} rows\n\n")

        if error:
            f.write(f"## Discovery aborted\n\n{error}\n")
            return {"shipped": False, "error": error, "report_path": str(out_path)}

        if idx is not None:
            tier_dist = joined["peer_tier"].value_counts().sort_index().to_dict()
            f.write(f"**Cascade tier distribution:** {tier_dist}\n\n")

        f.write(f"## Outcome\n\n")
        f.write(f"- **K = {result.k}** ({'SHIPS' if result.shipped else 'DOES NOT SHIP'})\n")
        f.write(f"- Features evaluated: {result.selected}\n\n")

        f.write(f"## Bootstrap lower-5% CIs\n\n")
        for k, v in result.last_bootstrap.items():
            f.write(f"- **{k}: {v:+.4f}**\n")

        if battery:
            f.write(f"\n## Validation battery (spec §6.4)\n\n")
            f.write(
                f"- Year-by-year IC: {battery['yby']['n_years']} years, "
                f"{battery['yby']['pct_positive_years']:.0%} positive (gate: ≥80%)\n"
            )
            f.write(
                f"- Permutation: {battery['perm']['sigma']:.2f}σ, "
                f"p={battery['perm']['p_value']:.4f} (gate: ≥3σ)\n"
            )
            f.write(
                f"- Battery: **{'PASS' if battery['passed'] else 'FAIL — ' + battery['reason']}**\n"
            )

        f.write(f"\n## Top 15 features by SHAP\n\n")
        f.write(ranking.head(15).to_markdown(index=False))

        if result.ridge_weights:
            f.write(f"\n\n## Ridge weights (production model)\n\n")
            wdf = pd.DataFrame({
                "feature": list(result.ridge_weights.keys()),
                "ridge_weight": list(result.ridge_weights.values()),
                "feature_mean": [result.feature_means[fn] for fn in result.ridge_weights],
                "feature_stdev": [result.feature_stdevs[fn] for fn in result.ridge_weights],
            })
            f.write(wdf.to_markdown(index=False))

    print(f"\nReport: {out_path}")
    return {"shipped": result.shipped, "k": result.k, "report_path": str(out_path)}


def main():
    ap = argparse.ArgumentParser(description="PropertyIQ Score V2 discovery pipeline (Path A: Parquet)")
    ap.add_argument("--geo-level", required=True, choices=["metro", "county", "zip", "state"])
    ap.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    ap.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    ap.add_argument("--n-bootstrap", type=int, default=1000,
                    help="Bootstrap resamples for CI gate (default 1000; use 200 for fast first-pass)")
    args = ap.parse_args()
    discover(args.geo_level, data_dir=args.data_dir, output_dir=args.output_dir, n_bootstrap=args.n_bootstrap)


if __name__ == "__main__":
    main()
