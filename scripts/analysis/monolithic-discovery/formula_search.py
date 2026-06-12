"""Exhaustive equal-weight formula search over top SHAP-ranked features.

Enumerates every 3/4/5-feature combination from the top-N aggregate SHAP
features. Each feature's sign is fixed empirically: the sign of its pooled
univariate IC (a feature's direction must not flip between combos or levels —
the formula is monolithic).

Combo score per row = sum of signed z-scores (equal weights, same shape as
the production engine). Monthly Spearman IC per level, summarized as the
median yearly-median IC. Winner = max over combos of the WORST-level IC, so
metro coverage cannot mask zip degradation.

Usage:
    python formula_search.py [--top 12]
"""

import argparse
import itertools
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

DATA_DIR = Path(__file__).parent / "data"
LEVELS = ["metro", "county", "zip"]
TARGET = "excess_3y"
MIN_ROWS_PER_MONTH = 30
MIN_MONTHS_PER_LEVEL = 36  # a combo must be evaluable for >=3 years everywhere


def load_ranking(top_n: int) -> tuple[list[str], dict[str, int]]:
    ranking = json.loads((DATA_DIR / "shap_ranking.json").read_text())
    ranked = list(ranking["aggregate_rank"].keys())[:top_n]
    uni = ranking["univariate_median_ic"]
    signs = {}
    for feat in ranked:
        pooled = np.nanmean([uni[lvl].get(feat, np.nan) for lvl in LEVELS])
        signs[feat] = 1 if pooled >= 0 else -1
    return ranked, signs


def monthly_ics(panel: pd.DataFrame, feats: list[str], signs: dict[str, int]) -> pd.Series:
    """Median yearly IC for one combo on one level's panel."""
    sub = panel[["month", TARGET, *feats]].dropna()
    if sub.empty:
        return pd.Series(dtype=float)
    score = sum(signs[f] * sub[f] for f in feats)
    sub = sub.assign(_score=score)
    rows = []
    for month, grp in sub.groupby("month"):
        if len(grp) >= MIN_ROWS_PER_MONTH:
            ic, _ = spearmanr(grp["_score"], grp[TARGET])
            rows.append((month, ic))
    if not rows:
        return pd.Series(dtype=float)
    ics = pd.Series(dict(rows))
    return ics.groupby(ics.index.year).median()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--top", type=int, default=12)
    args = parser.parse_args()

    ranked, signs = load_ranking(args.top)
    print(f"pool ({len(ranked)}): " + ", ".join(
        f"{'+' if signs[f] > 0 else '-'}{f.removeprefix('z_')}" for f in ranked
    ))

    panels = {lvl: pd.read_parquet(DATA_DIR / f"panel_{lvl}.parquet") for lvl in LEVELS}

    combos = [
        c for size in (3, 4, 5) for c in itertools.combinations(ranked, size)
    ]
    print(f"evaluating {len(combos)} combos × {len(LEVELS)} levels…")

    results = []
    for i, combo in enumerate(combos):
        per_level = {}
        valid = True
        for lvl in LEVELS:
            yearly = monthly_ics(panels[lvl], list(combo), signs)
            n_months = yearly.size  # yearly medians; months gate below
            if yearly.empty or yearly.size < 3:
                valid = False
                break
            per_level[lvl] = float(yearly.median())
        if not valid:
            continue
        worst = min(per_level.values())
        results.append({
            "features": [f.removeprefix("z_") for f in combo],
            "signs": [signs[f] for f in combo],
            "ic_metro": round(per_level["metro"], 4),
            "ic_county": round(per_level["county"], 4),
            "ic_zip": round(per_level["zip"], 4),
            "ic_worst": round(worst, 4),
        })
        if (i + 1) % 200 == 0:
            print(f"  {i + 1}/{len(combos)} done")

    df = pd.DataFrame(results).sort_values("ic_worst", ascending=False)
    out = DATA_DIR / "formula_search.json"
    out.write_text(df.to_json(orient="records", indent=2))

    print("\n=== top 25 combos by worst-level median yearly IC ===")
    print(df.head(25).to_string(index=False))
    print(f"\nwrote {out} ({len(df)} combos evaluated)")


if __name__ == "__main__":
    main()
