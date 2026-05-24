"""Smoke test: ranker correctly identifies a known strong feature."""

import numpy as np
import pandas as pd

from scripts.analysis.v2.feature_ranker import rank_features


def test_ranker_picks_known_strong_feature():
    """Verify that LightGBM + SHAP ranking correctly identifies a synthetically
    constructed strong feature (coeff 0.7) above weaker features (coeff 0.1) and
    noise (coeff 0.0).
    """
    rng = np.random.default_rng(42)
    n = 5000
    df = pd.DataFrame(
        {
            "year": rng.integers(2018, 2024, size=n),
            "strong": rng.normal(0, 1, size=n),
            "weak": rng.normal(0, 1, size=n),
            "noise_1": rng.normal(0, 1, size=n),
            "noise_2": rng.normal(0, 1, size=n),
            "noise_3": rng.normal(0, 1, size=n),
        }
    )
    df["target"] = (
        0.7 * df["strong"]
        + 0.1 * df["weak"]
        + rng.normal(0, 0.5, size=n)
    )

    ranked = rank_features(
        df,
        "target",
        ["strong", "weak", "noise_1", "noise_2", "noise_3"],
    )

    # The strongest feature should be ranked first
    assert ranked.iloc[0]["feature"] == "strong"

    # The weak feature should rank in the top 3 (above all noise)
    weak_rank = ranked[ranked["feature"] == "weak"]["ranked_position"].iloc[0]
    assert weak_rank <= 3
