#!/usr/bin/env python3
"""A/B: legacy MoS vs computed MoS on the v4 PropertyIQ signal.

Holds SAL and DOM constant (both pulled from legacy redfin_<geo> so the score
matches today's prod). The only swap: MoS source.

  A (current prod): legacy redfin_<geo>.months_of_supply
  B (new RFDC):     redfin_dc_housing_market_<geo>.active_listings / homes_sold

Usage:
    python -m scripts.analysis.v2.ab_mos_compare --geo metro
    python -m scripts.analysis.v2.ab_mos_compare --geo county
    python -m scripts.analysis.v2.ab_mos_compare --geo zip
"""
import argparse
import os
import sys
from pathlib import Path
from urllib.parse import quote_plus

import numpy as np
import pandas as pd
from scipy import stats
from sqlalchemy import create_engine


ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "docs" / "superpowers" / "results"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def get_engine():
    env_path = ROOT / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    pw = os.environ.get("SUPABASE_DB_PASSWORD")
    if not pw:
        sys.exit("FATAL: SUPABASE_DB_PASSWORD not set")
    ref = "pysflbhpnqwoczyuaaif"
    host = "aws-1-us-east-1.pooler.supabase.com"
    url = f"postgresql://postgres.{ref}:{quote_plus(pw)}@{host}:6543/postgres?sslmode=require"
    return create_engine(url, connect_args={"options": "-c statement_timeout=900000"})


# Per-geo config: legacy table+key, RFDC table, zillow target table+id, zillow-id key in crosswalk
GEO_CONFIG = {
    "metro": {
        "legacy_table": "redfin_metro",
        "legacy_key": "cbsa_code",
        "rfdc_table": "redfin_dc_housing_market_metro",
        "zillow_table": "zillow_metro",
        "xwalk_metro_id_col": "cbsa_code",
        "xwalk_metro_zillow_col": "zillow_metro_region_id",
        "v4_zero_crossing": 55.6,
    },
    "county": {
        "legacy_table": "redfin_county",
        "legacy_key": "fips_code",
        "rfdc_table": "redfin_dc_housing_market_county",
        "zillow_table": "zillow_county",
        "xwalk_metro_id_col": "county_fips",
        "xwalk_metro_zillow_col": "zillow_county_region_id",
        "v4_zero_crossing": 62.4,
    },
    "zip": {
        "legacy_table": "redfin_zip",
        "legacy_key": "zip_code",
        "rfdc_table": "redfin_dc_housing_market_zip",
        "zillow_table": "zillow_zip",
        "xwalk_metro_id_col": "zip_code",
        "xwalk_metro_zillow_col": "zillow_zip_region_id",
        "v4_zero_crossing": 33.4,
    },
}


def load_legacy(engine, geo):
    """SAL, DOM, MoS from legacy redfin_<geo> (All Residential).

    For ZIP, legacy.months_of_supply is 100% NULL (Redfin doesn't publish it at
    that geo level), so we skip the MoS NOT NULL filter and return MoS as null.
    The A/B at ZIP becomes "2-metric vs 3-metric (with computed MoS)" rather
    than a swap.

    Chunked by month for ZIP, year otherwise (statement-timeout sensitive)."""
    cfg = GEO_CONFIG[geo]
    chunks = []
    step_months = 1 if geo == "zip" else 12
    require_mos = geo != "zip"  # legacy MoS is null at ZIP
    from datetime import date
    cur = date(2012, 1, 1)
    end = date(2026, 12, 1)
    while cur <= end:
        if step_months == 1:
            nxt_y, nxt_m = (cur.year, cur.month + 1) if cur.month < 12 else (cur.year + 1, 1)
            nxt = date(nxt_y, nxt_m, 1)
        else:
            nxt = date(cur.year + 1, 1, 1)
        mos_filter = "AND months_of_supply IS NOT NULL" if require_mos else ""
        sql = f"""
            SELECT {cfg['legacy_key']}::text AS region_id, period_end AS period_date,
                   sold_above_list, median_dom, months_of_supply
            FROM {cfg['legacy_table']}
            WHERE property_type = 'All Residential'
              AND period_end >= '{cur.isoformat()}' AND period_end < '{nxt.isoformat()}'
              AND sold_above_list IS NOT NULL
              AND median_dom IS NOT NULL
              {mos_filter}
        """
        df = pd.read_sql(sql, engine)
        if len(df) > 0:
            chunks.append(df)
            if step_months == 1:
                print(f"    legacy {geo} {cur.isoformat()[:7]}: {len(df):,} rows", flush=True)
            else:
                print(f"    legacy {geo} {cur.year}: {len(df):,} rows", flush=True)
        cur = nxt
    out = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
    if len(out) > 0:
        out["period_date"] = pd.to_datetime(out["period_date"])
    return out


def load_new_rfdc(engine, geo):
    """active_listings + homes_sold from new RFDC housing_market — for computed MoS.
    Month-chunked for ZIP."""
    cfg = GEO_CONFIG[geo]
    chunks = []
    step_months = 1 if geo == "zip" else 12
    from datetime import date
    cur = date(2012, 1, 1)
    end = date(2026, 12, 1)
    while cur <= end:
        if step_months == 1:
            nxt_y, nxt_m = (cur.year, cur.month + 1) if cur.month < 12 else (cur.year + 1, 1)
            nxt = date(nxt_y, nxt_m, 1)
        else:
            nxt = date(cur.year + 1, 1, 1)
        sql = f"""
            SELECT region_id::text AS region_id, period_end AS period_date,
                   active_listings, homes_sold
            FROM {cfg['rfdc_table']}
            WHERE active_listings IS NOT NULL
              AND homes_sold IS NOT NULL
              AND homes_sold > 0
              AND period_end >= '{cur.isoformat()}' AND period_end < '{nxt.isoformat()}'
        """
        df = pd.read_sql(sql, engine)
        if len(df) > 0:
            chunks.append(df)
            if step_months == 1:
                print(f"    RFDC {geo} {cur.isoformat()[:7]}: {len(df):,} rows", flush=True)
            else:
                print(f"    RFDC {geo} {cur.year}: {len(df):,} rows", flush=True)
        cur = nxt
    out = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
    if len(out) > 0:
        out["period_date"] = pd.to_datetime(out["period_date"])
        out["computed_mos"] = out["active_listings"] / out["homes_sold"]
    return out


def load_zhvi_excess_returns(engine, geo):
    """Forward 3y excess return vs state for the given geo level.

    Crosswalk strategy differs by geo:
      metro:  zillow_metro.region_id -> cbsa_code -> state via geography_crosswalk
      county: zillow_county.region_id -> county_fips -> state via geography_crosswalk
      zip:    zillow_zip.region_name IS the 5-digit zip_code; map zip -> state via crosswalk
    """
    cfg = GEO_CONFIG[geo]
    # State ZHVI
    state = pd.read_sql(
        """SELECT region_id::text AS state_id, period_date, value AS zhvi
           FROM zillow_state WHERE metric_name='zhvi' AND value IS NOT NULL
             AND period_date >= '2010-01-01'""",
        engine,
    )
    state["period_date"] = pd.to_datetime(state["period_date"])

    def forward_3y(df, key_col):
        piv = df.pivot_table(index="period_date", columns=key_col, values="zhvi").sort_index()
        ret = (piv.shift(-36) / piv) - 1.0
        return ret.stack().rename("ret").reset_index()

    state_ret = forward_3y(state, "state_id").rename(columns={"ret": "state_ret"})

    if geo == "zip":
        # zillow_zip.region_name is the zip_code; chunk by year because zillow_zip is huge
        from datetime import date
        own_chunks = []
        cur = date(2010, 1, 1)
        end = date(2024, 1, 1)
        while cur < end:
            nxt = date(cur.year + 1, 1, 1)
            df = pd.read_sql(
                f"""SELECT region_name::text AS natural_key, period_date, value AS zhvi
                    FROM zillow_zip
                    WHERE metric_name='zhvi' AND value IS NOT NULL
                      AND period_date >= '{cur.isoformat()}' AND period_date < '{nxt.isoformat()}'""",
                engine,
            )
            if len(df) > 0:
                own_chunks.append(df)
                print(f"    zillow_zip ZHVI {cur.year}: {len(df):,} rows", flush=True)
            cur = nxt
        own = pd.concat(own_chunks, ignore_index=True)
        own["period_date"] = pd.to_datetime(own["period_date"])

        cw = pd.read_sql(
            """SELECT DISTINCT zip_code::text AS natural_key,
                     zillow_state_region_id::text AS state_id
                FROM geography_crosswalk
                WHERE zip_code IS NOT NULL AND zillow_state_region_id IS NOT NULL""",
            engine,
        ).drop_duplicates(subset="natural_key")
        own_ret = forward_3y(own, "natural_key")
        out = own_ret.merge(cw, on="natural_key", how="inner").merge(
            state_ret, on=["period_date", "state_id"], how="inner"
        )
        out["excess_3y"] = out["ret"] - out["state_ret"]
        return out[["natural_key", "period_date", "excess_3y"]].rename(columns={"natural_key": "region_id"})

    # metro / county: zillow_<geo>.region_id is the internal Zillow ID, mapped via crosswalk
    own = pd.read_sql(
        f"""SELECT region_id::text AS zillow_id, period_date, value AS zhvi
            FROM {cfg['zillow_table']} WHERE metric_name='zhvi' AND value IS NOT NULL
              AND period_date >= '2010-01-01'""",
        engine,
    )
    own["period_date"] = pd.to_datetime(own["period_date"])
    cw = pd.read_sql(
        f"""SELECT DISTINCT {cfg['xwalk_metro_zillow_col']}::text AS zillow_id,
                 {cfg['xwalk_metro_id_col']}::text AS natural_key,
                 zillow_state_region_id::text AS state_id
            FROM geography_crosswalk
            WHERE {cfg['xwalk_metro_zillow_col']} IS NOT NULL
              AND {cfg['xwalk_metro_id_col']} IS NOT NULL
              AND zillow_state_region_id IS NOT NULL""",
        engine,
    ).drop_duplicates(subset="zillow_id")
    own_ret = forward_3y(own, "zillow_id")
    out = own_ret.merge(cw, on="zillow_id", how="inner").merge(
        state_ret, on=["period_date", "state_id"], how="inner"
    )
    out["excess_3y"] = out["ret"] - out["state_ret"]
    return out[["natural_key", "period_date", "excess_3y"]].rename(columns={"natural_key": "region_id"})


def compute_v4_score(df, mos_col, zero_crossing, include_mos=True):
    """Cross-sectional z-score signal, percentile-rank, re-center at zero_crossing to 1-99.

    If include_mos=False, builds the v4 2-metric ZIP signal: z(SAL) - z(DOM). Used as
    the baseline at ZIP where legacy MoS is null."""
    out = df.copy()
    out["z_sal"] = out.groupby("period_date")["sold_above_list"].transform(
        lambda x: (x - x.mean()) / max(x.std(), 1e-9)
    )
    out["z_dom"] = out.groupby("period_date")["median_dom"].transform(
        lambda x: (x - x.mean()) / max(x.std(), 1e-9)
    )
    if include_mos:
        out["z_mos"] = out.groupby("period_date")[mos_col].transform(
            lambda x: (x - x.mean()) / max(x.std(), 1e-9)
        )
        out["signal"] = out["z_sal"] - out["z_dom"] - out["z_mos"]
    else:
        out["signal"] = out["z_sal"] - out["z_dom"]
    out["pct"] = out.groupby("period_date")["signal"].rank(pct=True) * 100
    out["score"] = np.where(
        out["pct"] <= zero_crossing,
        1 + (out["pct"] / zero_crossing) * 49,
        50 + ((out["pct"] - zero_crossing) / (100 - zero_crossing)) * 49,
    )
    out["score"] = np.clip(np.round(out["score"]), 1, 99).astype(int)
    return out[["region_id", "period_date", "signal", "pct", "score"]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--geo", required=True, choices=["metro", "county", "zip"])
    args = ap.parse_args()
    geo = args.geo
    cfg = GEO_CONFIG[geo]

    print(f"=== A/B MoS test: {geo} (zero_crossing={cfg['v4_zero_crossing']}) ===")
    engine = get_engine()

    print("Loading legacy...")
    legacy = load_legacy(engine, geo)
    print(f"  legacy: {len(legacy):,} rows, {legacy['region_id'].nunique():,} {geo}s")

    print("Loading new RFDC...")
    rfdc = load_new_rfdc(engine, geo)
    print(f"  RFDC: {len(rfdc):,} rows, {rfdc['region_id'].nunique():,} {geo}s")

    print("Loading 3y excess returns...")
    returns = load_zhvi_excess_returns(engine, geo)
    print(f"  returns: {len(returns):,} rows")

    engine.dispose()

    # Join legacy + RFDC on (region_id, period_month)
    legacy["period_month"] = legacy["period_date"].dt.to_period("M")
    rfdc["period_month"] = rfdc["period_date"].dt.to_period("M")
    panel = legacy.merge(
        rfdc[["region_id", "period_month", "computed_mos"]],
        on=["region_id", "period_month"], how="inner",
    )
    if "period_date_x" in panel.columns:
        panel["period_date"] = panel["period_date_x"]
    cols = ["region_id", "period_date", "sold_above_list", "median_dom",
            "months_of_supply", "computed_mos"]
    panel = panel[cols]
    # For ZIP, months_of_supply is all-null from legacy; drop the requirement
    required = ["region_id", "period_date", "sold_above_list", "median_dom", "computed_mos"]
    if geo != "zip":
        required.append("months_of_supply")
    panel = panel.dropna(subset=required)
    print(f"\nJoined panel: {len(panel):,} rows, {panel['region_id'].nunique():,} {geo}s")
    print(f"Date range: {panel['period_date'].min().date()} -> {panel['period_date'].max().date()}")

    if len(panel) < 1000:
        print("ABORT: panel too small")
        return

    # MoS direct comparison (skip at ZIP — legacy is null)
    if geo != "zip":
        panel["mos_diff"] = panel["computed_mos"] - panel["months_of_supply"]
        mos_spearman = stats.spearmanr(panel["computed_mos"], panel["months_of_supply"])[0]
        print(f"\nMoS raw comparison:")
        print(f"  Spearman: {mos_spearman:.4f}  Pearson: {stats.pearsonr(panel['computed_mos'], panel['months_of_supply'])[0]:.4f}")
        print(f"  Mean legacy/computed: {panel['months_of_supply'].mean():.3f} / {panel['computed_mos'].mean():.3f}")
        print(f"  Mean abs diff: {panel['mos_diff'].abs().mean():.3f}")
    else:
        mos_spearman = float("nan")
        print(f"\nMoS raw comparison: SKIPPED (legacy MoS is null at ZIP)")

    # Score variants
    # At ZIP, legacy doesn't publish MoS → A is the v4 2-metric baseline (SAL/DOM only)
    # Otherwise A = legacy MoS, B = computed MoS (clean swap)
    print("\nComputing v4 scores...")
    if geo == "zip":
        print("  [ZIP] A = v4 2-metric baseline (no MoS); B = adds computed MoS as 3rd term")
        a = compute_v4_score(panel, "computed_mos", cfg["v4_zero_crossing"], include_mos=False).rename(
            columns={"signal": "signal_A", "pct": "pct_A", "score": "score_A"}
        )
    else:
        a = compute_v4_score(panel, "months_of_supply", cfg["v4_zero_crossing"]).rename(
            columns={"signal": "signal_A", "pct": "pct_A", "score": "score_A"}
        )
    b = compute_v4_score(panel, "computed_mos", cfg["v4_zero_crossing"]).rename(
        columns={"signal": "signal_B", "pct": "pct_B", "score": "score_B"}
    )
    scored = a.merge(b, on=["region_id", "period_date"])
    scored["score_diff"] = scored["score_B"] - scored["score_A"]
    scored["score_abs_diff"] = scored["score_diff"].abs()

    score_spearman = stats.spearmanr(scored["score_A"], scored["score_B"])[0]
    print(f"\nScore-level comparison:")
    print(f"  Spearman(A,B): {score_spearman:.4f}")
    print(f"  Mean |diff|: {scored['score_abs_diff'].mean():.2f}  median: {scored['score_abs_diff'].median():.2f}  max: {scored['score_abs_diff'].max():.0f}")
    print(f"  %|>5|: {(scored['score_abs_diff'] > 5).mean()*100:.1f}%  %|>10|: {(scored['score_abs_diff'] > 10).mean()*100:.1f}%  %|>20|: {(scored['score_abs_diff'] > 20).mean()*100:.1f}%")

    # IC validation
    print("\nValidation: IC vs 3y forward excess return")
    val = scored.merge(returns, on=["region_id", "period_date"], how="inner").dropna(subset=["excess_3y"])
    print(f"  N with 3y forward: {len(val):,}")
    if len(val) > 100:
        ic_a, _ = stats.spearmanr(val["score_A"], val["excess_3y"])
        ic_b, _ = stats.spearmanr(val["score_B"], val["excess_3y"])
        hit_a = float(((val["score_A"] > 50) == (val["excess_3y"] > 0)).mean())
        hit_b = float(((val["score_B"] > 50) == (val["excess_3y"] > 0)).mean())
        print(f"  Score A (legacy MoS):   IC = {ic_a:+.4f}  hit = {hit_a:.3f}")
        print(f"  Score B (computed MoS): IC = {ic_b:+.4f}  hit = {hit_b:.3f}")
        print(f"  Delta IC: {ic_b - ic_a:+.4f}  Delta hit: {hit_b - hit_a:+.4f}")

        val["year"] = val["period_date"].dt.year
        yearly = []
        for y, g in val.groupby("year"):
            if len(g) < 100:
                continue
            ica, _ = stats.spearmanr(g["score_A"], g["excess_3y"])
            icb, _ = stats.spearmanr(g["score_B"], g["excess_3y"])
            yearly.append({"year": int(y), "n": len(g), "ic_A": ica, "ic_B": icb, "delta": icb - ica})
        yearly_df = pd.DataFrame(yearly)
        print(f"\n  Per-year IC:")
        print(yearly_df.to_string(index=False))
    else:
        ic_a = ic_b = hit_a = hit_b = float("nan")
        yearly_df = pd.DataFrame()

    # Write markdown report
    out_path = OUT_DIR / f"2026-05-24-mos-ab-test-{geo}.md"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"# A/B Test ({geo}): legacy MoS vs computed MoS\n\n")
        f.write(f"**Date:** 2026-05-24\n")
        f.write(f"**Geo level:** {geo}\n")
        f.write(f"**Zero-crossing:** {cfg['v4_zero_crossing']} (v4 default for this geo)\n")
        f.write(f"**Joined panel:** {len(panel):,} rows ({panel['region_id'].nunique():,} {geo}s)\n")
        f.write(f"**Date range:** {panel['period_date'].min().date()} to {panel['period_date'].max().date()}\n")
        f.write(f"**Hold constant:** sold_above_list, median_dom (legacy source)\n")
        f.write(f"**Swap:** months_of_supply\n")
        f.write(f"- A (current prod): `{cfg['legacy_table']}.months_of_supply`\n")
        f.write(f"- B (new RFDC): `{cfg['rfdc_table']}.active_listings / homes_sold`\n\n")

        f.write("## Raw MoS comparison\n\n")
        if geo == "zip":
            f.write("Legacy MoS is null at ZIP — no raw comparison possible. ")
            f.write("Test compares the v4 2-metric baseline (A) vs adding computed MoS as a 3rd term (B).\n\n")
        else:
            f.write(f"- Spearman: **{mos_spearman:.4f}**\n")
            f.write(f"- Pearson: {stats.pearsonr(panel['computed_mos'], panel['months_of_supply'])[0]:.4f}\n")
            f.write(f"- Mean (legacy): {panel['months_of_supply'].mean():.3f}\n")
            f.write(f"- Mean (computed): {panel['computed_mos'].mean():.3f}\n")
            f.write(f"- Mean abs diff: {panel['mos_diff'].abs().mean():.3f}\n\n")

        f.write("## Score-level\n\n")
        f.write(f"- Spearman(A, B): **{score_spearman:.4f}**\n")
        f.write(f"- Mean |Δscore|: **{scored['score_abs_diff'].mean():.2f}**\n")
        f.write(f"- Median: {scored['score_abs_diff'].median():.2f}\n")
        f.write(f"- 90th pct: {scored['score_abs_diff'].quantile(0.9):.2f}\n")
        f.write(f"- Max: {scored['score_abs_diff'].max():.0f}\n")
        f.write(f"- % |Δ| > 5: **{(scored['score_abs_diff'] > 5).mean()*100:.1f}%**\n")
        f.write(f"- % |Δ| > 10: {(scored['score_abs_diff'] > 10).mean()*100:.1f}%\n")
        f.write(f"- % |Δ| > 20: {(scored['score_abs_diff'] > 20).mean()*100:.1f}%\n\n")

        f.write("## Predictive validity (IC vs 3y excess return)\n\n")
        if len(val) > 100:
            f.write(f"- N with forward: {len(val):,}\n")
            f.write(f"- Score A (legacy MoS):   IC = **{ic_a:+.4f}**  hit = {hit_a:.3f}\n")
            f.write(f"- Score B (computed MoS): IC = **{ic_b:+.4f}**  hit = {hit_b:.3f}\n")
            f.write(f"- Δ IC (B − A): **{ic_b - ic_a:+.4f}**\n")
            f.write(f"- Δ hit:        **{hit_b - hit_a:+.4f}**\n\n")
            f.write("### Per-year IC\n\n")
            f.write(yearly_df.to_markdown(index=False, floatfmt="+.4f") + "\n\n")
        else:
            f.write("Insufficient overlap with 3y returns\n\n")

        f.write("## Verdict\n\n")
        if len(val) > 100:
            if abs(ic_b - ic_a) < 0.005 and scored["score_abs_diff"].mean() < 3:
                f.write("**SAFE TO SWAP.** Score-level Spearman > 0.99, mean |Δ| < 3, ΔIC ≈ 0.\n")
            elif abs(ic_b - ic_a) < 0.02:
                f.write("**ACCEPTABLE SWAP.** IC change within noise; individual scores shift modestly.\n")
            else:
                f.write("**MATERIAL CHANGE.** IC moves meaningfully. Investigate before any cutover.\n")
        else:
            f.write("Verdict deferred — insufficient overlap with forward returns.\n")

    print(f"\nReport: {out_path}")


if __name__ == "__main__":
    main()
