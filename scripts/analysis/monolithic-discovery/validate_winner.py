"""Validation battery for the winning monolithic formula.

Per geo level:
  - year-by-year median monthly Spearman IC (gate: >=80% positive years)
  - permutation significance: actual median IC vs null from within-month
    target shuffles (gate: >=3 sigma)
  - decile spread: top-decile mean excess_3y minus bottom-decile, median
    across months (annualized pp, since excess_3y is annualized)
  - baseline: the current v4 formula replicated from legacy redfin tables
    (z(sold_above_list) - z(median_dom) - z(months_of_supply)) and evaluated
    against the SAME excess_3y target on the same vintage window

Usage:
    python validate_winner.py                      # winner = top of formula_search.json
    python validate_winner.py --rank 3             # validate the 3rd-ranked combo
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

from db import get_engine

DATA_DIR = Path(__file__).parent / "data"
LEVELS = ["metro", "county", "zip"]
TARGET = "excess_3y"
MIN_ROWS_PER_MONTH = 30
N_PERMUTATIONS = 300
SEED = 42
VINTAGE_START = "2016-07-01"
VINTAGE_END = "2023-01-31"


def combo_scores(panel: pd.DataFrame, feats: list[str], signs: list[int]) -> pd.DataFrame:
    cols = [f"z_{f}" for f in feats]
    sub = panel[["month", TARGET, *cols]].dropna().copy()
    sub["score"] = sum(s * sub[c] for s, c in zip(signs, cols))
    return sub


def monthly_ic_series(scored: pd.DataFrame, score_col: str = "score") -> pd.Series:
    rows = {}
    for month, grp in scored.groupby("month"):
        if len(grp) >= MIN_ROWS_PER_MONTH:
            rows[month], _ = spearmanr(grp[score_col], grp[TARGET])
    return pd.Series(rows).sort_index()


def permutation_sigma(scored: pd.DataFrame, actual_median_ic: float) -> float:
    rng = np.random.default_rng(SEED)
    months = [grp for _, grp in scored.groupby("month") if len(grp) >= MIN_ROWS_PER_MONTH]
    nulls = []
    for _ in range(N_PERMUTATIONS):
        ics = []
        for grp in months:
            shuffled = rng.permutation(grp[TARGET].to_numpy())
            ic, _ = spearmanr(grp["score"], shuffled)
            ics.append(ic)
        nulls.append(np.median(ics))
    nulls = np.asarray(nulls)
    return float((actual_median_ic - nulls.mean()) / nulls.std())


def decile_spread(scored: pd.DataFrame) -> float:
    spreads = []
    for _, grp in scored.groupby("month"):
        if len(grp) < 100:
            continue
        deciles = pd.qcut(grp["score"], 10, labels=False, duplicates="drop")
        means = grp.groupby(deciles)[TARGET].mean()
        if len(means) >= 10:
            spreads.append(means.iloc[-1] - means.iloc[0])
    return float(np.median(spreads)) if spreads else np.nan


# Legacy Redfin tables + id column per level, for replicating the current
# v4 formula as the baseline (propertyiq_backtest_outcomes only holds the
# retired legacy score types in this window, not v4).
REDFIN_LEGACY = {
    "metro": ("redfin_metro", "cbsa_code"),
    "county": ("redfin_county", "fips_code"),
    "zip": ("redfin_zip", "zip_code"),
}


def baseline_v4_ic(engine, level: str, panel: pd.DataFrame) -> dict:
    """Replicate v4: z(sold_above_list) - z(median_dom) - z(months_of_supply),
    evaluated against the same excess_3y target as the candidate formulas."""
    table, id_col = REDFIN_LEGACY[level]
    df = pd.read_sql(
        f"""
        SELECT {id_col} AS location_id, period_end,
               sold_above_list, median_dom, months_of_supply
        FROM {table}
        WHERE property_type = 'All Residential'
          AND period_end BETWEEN '{VINTAGE_START}' AND '{VINTAGE_END}'
        """,
        engine,
        chunksize=500_000,
    )
    df = pd.concat(df, ignore_index=True)
    df["month"] = pd.to_datetime(df["period_end"]).dt.to_period("M").dt.to_timestamp()
    df = df.drop_duplicates(subset=["location_id", "month"], keep="last")

    for col in ("sold_above_list", "median_dom", "months_of_supply"):
        grouped = df.groupby("month")[col]
        df[f"z_{col}"] = (df[col] - grouped.transform("mean")) / grouped.transform("std")
    # v4 requires >=2 of 3 inputs; missing z contributes 0, matching engine.
    n_present = df[["z_sold_above_list", "z_median_dom", "z_months_of_supply"]].notna().sum(axis=1)
    df["score"] = (
        df["z_sold_above_list"].fillna(0)
        - df["z_median_dom"].fillna(0)
        - df["z_months_of_supply"].fillna(0)
    )
    df = df[n_present >= 2]

    target = panel[["location_id", "month", TARGET]].dropna()
    scored = df[["location_id", "month", "score"]].merge(
        target, on=["location_id", "month"], how="inner"
    )
    ics = monthly_ic_series(scored)
    if ics.empty:
        return {"median_yearly_ic": None, "n_months": 0}
    yearly = ics.groupby(ics.index.year).median()
    return {
        "median_yearly_ic": round(float(yearly.median()), 4),
        "yearly": {int(y): round(float(v), 4) for y, v in yearly.items()},
        "n_months": len(ics),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rank", type=int, default=1)
    args = parser.parse_args()

    combos = json.loads((DATA_DIR / "formula_search.json").read_text())
    winner = combos[args.rank - 1]
    feats, signs = winner["features"], winner["signs"]
    print("validating: " + " ".join(
        f"{'+' if s > 0 else '-'}{f}" for f, s in zip(feats, signs)
    ))

    engine = get_engine()
    report = {"features": feats, "signs": signs, "levels": {}}
    for level in LEVELS:
        panel = pd.read_parquet(DATA_DIR / f"panel_{level}.parquet")
        scored = combo_scores(panel, feats, signs)
        ics = monthly_ic_series(scored)
        yearly = ics.groupby(ics.index.year).median()
        median_ic = float(yearly.median())
        sigma = permutation_sigma(scored, float(ics.median()))
        spread = decile_spread(scored)
        base = baseline_v4_ic(engine, level, panel)
        report["levels"][level] = {
            "median_yearly_ic": round(median_ic, 4),
            "yearly_ic": {int(y): round(float(v), 4) for y, v in yearly.items()},
            "pct_positive_years": round(100 * (yearly > 0).mean(), 1),
            "permutation_sigma": round(sigma, 1),
            "decile_spread_pp": round(100 * spread, 2),
            "n_months": len(ics),
            "baseline_v4": base,
        }
        print(f"[{level}] median yearly IC={median_ic:.4f} "
              f"positive_years={report['levels'][level]['pct_positive_years']}% "
              f"perm={sigma:.1f}sigma spread={100 * spread:.2f}pp "
              f"baseline_v4={base['median_yearly_ic']}")

    out = DATA_DIR / "validation.json"
    out.write_text(json.dumps(report, indent=2))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
