"""Spec §6.4 validation battery — gate tests not already in forward_add.

Test 2: year-by-year IC (≥80% of years must show positive IC).
Test 4: 5000-shuffle permutation significance (model IC must be ≥3σ above
the null distribution of shuffled-target ICs).
"""

import numpy as np
import pandas as pd
from scipy import stats


def year_by_year_ic(df: pd.DataFrame, *, score_col: str, target_col: str, year_col: str) -> dict:
    """For each year, compute Spearman IC of score vs target. Report fraction
    of years with positive IC. Gate (spec §6.4 test 2): ≥80% positive."""
    by_year = []
    for yr, sub in df.dropna(subset=[score_col, target_col]).groupby(year_col):
        if len(sub) < 30:
            continue
        ic, _ = stats.spearmanr(sub[score_col], sub[target_col])
        if np.isfinite(ic):
            by_year.append({"year": yr, "ic": float(ic), "n": len(sub)})
    if not by_year:
        return {"n_years": 0, "pct_positive_years": 0.0, "years": []}
    pct_pos = sum(1 for y in by_year if y["ic"] > 0) / len(by_year)
    return {"n_years": len(by_year), "pct_positive_years": pct_pos, "years": by_year}


def permutation_significance(score: np.ndarray, target: np.ndarray, *, n_shuffles: int = 5000, rng=None) -> dict:
    """Shuffle the score vector n_shuffles times; compute Spearman IC each
    time to build a null distribution. Report how many sigma the actual IC
    is above the null. Gate (spec §6.4 test 4): ≥3σ."""
    rng = rng if rng is not None else np.random.default_rng(42)
    actual_ic, _ = stats.spearmanr(score, target)
    nulls = np.empty(n_shuffles)
    score = np.asarray(score)
    target = np.asarray(target)
    for i in range(n_shuffles):
        nulls[i], _ = stats.spearmanr(rng.permutation(score), target)
    nulls = nulls[np.isfinite(nulls)]
    null_std = float(np.std(nulls)) if len(nulls) > 1 else 1e-9
    sigma = float(actual_ic) / max(null_std, 1e-9)
    p = float(np.mean(np.abs(nulls) >= abs(actual_ic)))
    return {"actual_ic": float(actual_ic), "null_mean": float(np.mean(nulls)), "null_std": null_std, "sigma": sigma, "p_value": p, "n_shuffles": len(nulls)}


def passes_battery(yby: dict, perm: dict, *, year_pct_min: float = 0.80, sigma_min: float = 3.0) -> tuple[bool, str]:
    """Combined gate check. Returns (passes, reason_if_failed)."""
    if yby["n_years"] < 3:
        return False, f"too few years ({yby['n_years']}) — need ≥3"
    if yby["pct_positive_years"] < year_pct_min:
        return False, f"year-by-year positive share {yby['pct_positive_years']:.0%} < {year_pct_min:.0%}"
    if perm["sigma"] < sigma_min:
        return False, f"permutation sigma {perm['sigma']:.2f} < {sigma_min}"
    return True, "passes"
