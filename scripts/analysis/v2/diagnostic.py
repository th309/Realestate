#!/usr/bin/env python3
"""
PIQ V2 discovery diagnostic — EDA before modeling.

For a given geo_level, computes:
  1. Feature coverage matrix (feature x year, % non-null) -> CSV
  2. Target sanity: excess_3y distribution by year, by peer tier -> stdout + report
  3. Univariate Spearman IC of each feature vs excess_3y -> CSV (sorted by |IC|)
  4. Markdown summary

Run BEFORE the discovery modeling pipeline to confirm the data supports it.

Usage:
  python -m scripts.analysis.v2.diagnostic --geo-level metro
"""

import argparse
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

from scripts.analysis.v2.discover import (
    DEFAULT_THRESHOLDS,
    _load_geos,
    _load_zhvi,
)
from scripts.analysis.v2.feature_loader import load_feature_panel
from scripts.analysis.v2.peer_cascade import build_peer_index
from scripts.analysis.v2.target_builder import compute_excess, compute_forward_returns


DATA_DIR = Path(__file__).parent / "data"
OUT_DIR = Path(__file__).resolve().parents[3] / "docs" / "superpowers" / "results"


def build_target_panel(geo_level: str) -> tuple[pd.DataFrame, dict]:
    """Returns (excess_panel, tier_distribution)."""
    zhvi = _load_zhvi(DATA_DIR, geo_level)
    fr = compute_forward_returns(zhvi, horizon_months=36)
    geos = _load_geos(DATA_DIR, geo_level)
    periods = fr["period_date"].unique()
    full_geos = (
        geos[["region_id", "state_abbrev", "division", "region"]]
        .merge(pd.DataFrame({"period_date": periods}), how="cross")
    )
    idx = build_peer_index(full_geos, **DEFAULT_THRESHOLDS)
    ex = compute_excess(fr, idx, horizon_months=36).dropna(subset=["excess_3y"])
    return ex, dict(ex["peer_tier"].value_counts().sort_index())


def build_joined_panel(geo_level: str, ex: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Inner-join target panel with feature panel."""
    fp = load_feature_panel(geo_level, data_dir=DATA_DIR)
    ex = ex.copy()
    ex["period_month"] = ex["period_date"].dt.to_period("M")
    fp_df = fp.df.copy()
    fp_df["period_month"] = fp_df["period_date"].dt.to_period("M")
    joined = ex.merge(
        fp_df[["region_id", "period_month"] + fp.feature_cols],
        on=["region_id", "period_month"], how="inner"
    )
    joined["year"] = joined["period_date"].dt.year
    return joined, fp.feature_cols


def coverage_matrix(joined: pd.DataFrame, feature_cols: list[str]) -> pd.DataFrame:
    """Per-feature per-year non-null fraction."""
    cov = joined.groupby("year")[feature_cols].apply(lambda g: g.notna().mean()).T
    cov.index.name = "feature"
    cov.columns.name = "year"
    return cov


def target_summary(joined: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    by_year = joined.groupby("year")["excess_3y"].agg(["count", "mean", "std", "min", "max"]).round(4)
    by_tier = joined.groupby("peer_tier")["excess_3y"].agg(["count", "mean", "std", "min", "max"]).round(4)
    return by_year, by_tier


def univariate_ic(joined: pd.DataFrame, feature_cols: list[str]) -> pd.DataFrame:
    """Spearman IC of each feature vs excess_3y. Includes per-year stability."""
    rows = []
    for c in feature_cols:
        sub = joined[[c, "excess_3y", "year"]].dropna()
        if len(sub) < 100:
            rows.append({
                "feature": c, "ic_overall": np.nan, "p_value": np.nan,
                "abs_ic": np.nan, "n_obs": len(sub), "n_years": 0,
                "pct_positive_years": np.nan, "ic_year_mean": np.nan,
                "ic_year_std": np.nan,
            })
            continue
        ic_overall, p_val = stats.spearmanr(sub[c], sub["excess_3y"])
        per_year = []
        for _, g in sub.groupby("year"):
            if len(g) >= 50:
                yr_ic, _ = stats.spearmanr(g[c], g["excess_3y"])
                if np.isfinite(yr_ic):
                    per_year.append(yr_ic)
        n_pos = sum(1 for x in per_year if x > 0)
        rows.append({
            "feature": c,
            "ic_overall": ic_overall,
            "p_value": p_val,
            "abs_ic": abs(ic_overall) if np.isfinite(ic_overall) else np.nan,
            "n_obs": len(sub),
            "n_years": len(per_year),
            "pct_positive_years": (n_pos / len(per_year)) if per_year else np.nan,
            "ic_year_mean": np.mean(per_year) if per_year else np.nan,
            "ic_year_std": np.std(per_year) if len(per_year) > 1 else np.nan,
        })
    return pd.DataFrame(rows).sort_values("abs_ic", ascending=False, na_position="last")


def write_report(geo_level: str, joined: pd.DataFrame, feature_cols: list[str],
                 tier_dist: dict, cov: pd.DataFrame, by_year: pd.DataFrame,
                 by_tier: pd.DataFrame, ic: pd.DataFrame) -> Path:
    out = OUT_DIR / f"{date.today().isoformat()}-{geo_level}-diagnostic.md"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    n_cov_30_post2012 = int((cov.loc[:, cov.columns >= 2012] >= 0.30).any(axis=1).sum())
    n_features_strong_ic = int((ic["abs_ic"] >= 0.05).sum())
    top10 = ic.head(10)
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"# {geo_level.capitalize()} pre-modeling diagnostic\n\n")
        f.write(f"**Run date:** {date.today().isoformat()}\n\n")
        f.write("## Panel scale\n\n")
        f.write(f"- Joined panel: **{len(joined):,} rows** "
                f"({joined['period_date'].min().date()} -> {joined['period_date'].max().date()})\n")
        f.write(f"- Candidate features: **{len(feature_cols)}**\n")
        f.write(f"- Peer tier distribution: {tier_dist}\n\n")
        f.write("## Feature coverage (post-2012)\n\n")
        f.write(f"- Features with >=30% coverage in ANY post-2012 year: **{n_cov_30_post2012} / {len(feature_cols)}**\n\n")
        f.write("### Features w/ >=30% coverage by year (count)\n\n")
        yearly_active = (cov >= 0.30).sum(axis=0)
        f.write("```\n")
        f.write(yearly_active.to_string() + "\n")
        f.write("```\n\n")
        f.write("## Target sanity\n\n")
        f.write("### excess_3y by year\n\n")
        f.write("```\n" + by_year.to_string() + "\n```\n\n")
        f.write("### excess_3y by peer tier\n\n")
        f.write("```\n" + by_tier.to_string() + "\n```\n\n")
        f.write("## Univariate predictive power (Spearman IC vs excess_3y)\n\n")
        f.write(f"- Features with |IC| >= 0.05: **{n_features_strong_ic} / {len(feature_cols)}**\n\n")
        f.write("### Top 10 by |IC|\n\n")
        f.write("```\n" + top10[["feature", "ic_overall", "p_value", "n_obs", "pct_positive_years", "ic_year_mean"]].to_string(index=False) + "\n```\n\n")
        f.write("## Verdict\n\n")
        if n_features_strong_ic == 0:
            f.write("**❌ Modeling will not produce signal.** Even the strongest univariate IC is below 0.05 — "
                    "LightGBM and ridge can't compose meaningful predictions from features that don't individually correlate.\n")
        elif n_features_strong_ic < 3:
            f.write(f"**⚠ Marginal.** Only {n_features_strong_ic} features above |IC|=0.05. "
                    "Modeling may produce K=1-3 but will struggle to clear strict bar (IC >= 0.15 lower-CI).\n")
        else:
            f.write(f"**✅ Worth running the full pipeline.** {n_features_strong_ic} features above |IC|=0.05 — "
                    "enough raw material for LightGBM+SHAP feature discovery to work with.\n")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--geo-level", required=True, choices=["metro", "county", "zip", "state"])
    args = ap.parse_args()
    level = args.geo_level

    print(f"=== Diagnostic: {level} ===")

    print("Building target panel...")
    ex, tier_dist = build_target_panel(level)
    print(f"  Target panel: {len(ex):,} rows | tier dist: {tier_dist}")

    print("Joining features...")
    joined, feature_cols = build_joined_panel(level, ex)
    print(f"  Joined: {len(joined):,} rows x {len(feature_cols)} features")
    print(f"  Date range: {joined['period_date'].min().date()} -> {joined['period_date'].max().date()}")

    print("Coverage matrix...")
    cov = coverage_matrix(joined, feature_cols)
    cov_path = DATA_DIR / f"diagnostic-{level}-coverage.csv"
    cov.to_csv(cov_path, float_format="%.3f")
    print(f"  -> {cov_path}")
    yearly_active = (cov >= 0.30).sum(axis=0)
    print(f"  Features w/ >=30% coverage by year:\n{yearly_active.to_string()}")

    print("\nTarget sanity...")
    by_year, by_tier = target_summary(joined)
    print(f"  by year:\n{by_year.to_string()}")
    print(f"\n  by peer tier:\n{by_tier.to_string()}")

    print("\nUnivariate IC pass...")
    ic = univariate_ic(joined, feature_cols)
    ic_path = DATA_DIR / f"diagnostic-{level}-univariate-ic.csv"
    ic.to_csv(ic_path, index=False, float_format="%.4f")
    print(f"  -> {ic_path}")
    print(f"  Top 20 by |IC|:")
    cols_to_show = ["feature", "ic_overall", "p_value", "n_obs", "pct_positive_years", "ic_year_mean"]
    print(ic.head(20)[cols_to_show].to_string(index=False))
    n_strong = int((ic["abs_ic"] >= 0.05).sum())
    print(f"\n  Features with |IC| >= 0.05: {n_strong} / {len(feature_cols)}")

    print("\nWriting markdown report...")
    report = write_report(level, joined, feature_cols, tier_dist, cov, by_year, by_tier, ic)
    print(f"  -> {report}")
    print("\nDone.")


if __name__ == "__main__":
    main()
