"""Tests for the validation battery (year-by-year IC, permutation)."""

import numpy as np
import pandas as pd

from scripts.analysis.v2.validation import year_by_year_ic, permutation_significance


def test_year_by_year_ic_counts_positive_years():
    rng = np.random.default_rng(0)
    df = pd.DataFrame({
        "score": np.concatenate([rng.normal(0, 1, 100) for _ in range(5)]),
        "excess_3y": np.concatenate([rng.normal(0, 1, 100) for _ in range(5)]),
        "year": np.repeat([2018, 2019, 2020, 2021, 2022], 100),
    })
    df.loc[df["year"] != 2020, "excess_3y"] = (
        df.loc[df["year"] != 2020, "score"] * 0.5
        + rng.normal(0, 0.3, len(df[df["year"] != 2020]))
    )
    result = year_by_year_ic(df, score_col="score", target_col="excess_3y", year_col="year")
    assert result["n_years"] == 5
    assert result["pct_positive_years"] >= 0.6


def test_permutation_significance_detects_real_signal():
    rng = np.random.default_rng(0)
    n = 2000
    score = rng.normal(0, 1, n)
    excess = 0.5 * score + rng.normal(0, 0.5, n)
    result = permutation_significance(score, excess, n_shuffles=500, rng=rng)
    assert result["sigma"] > 3
    assert result["p_value"] < 0.01
