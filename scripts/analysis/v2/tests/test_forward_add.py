"""Stopping rule tests on synthetic data with known signal strength.

When we feed in a strong feature followed by pure noise, the forward-add
should stop at K=1. When we feed pure noise we should never clear the bar
and return K=0 (or hit K_max).
"""

import numpy as np
import pandas as pd

from scripts.analysis.v2.forward_add import forward_add_with_ci_gate, StrictBar


def _panel(features_dict, target):
    df = pd.DataFrame(features_dict)
    df["target"] = target
    df["year"] = np.tile(np.arange(2017, 2024), int(np.ceil(len(df) / 7)))[: len(df)]
    return df


def test_stops_at_k_1_when_one_feature_carries_signal():
    rng = np.random.default_rng(0)
    n = 8000
    strong = rng.normal(0, 1, n)
    target = 1.2 * strong + rng.normal(0, 0.4, n)
    df = _panel({
        "strong": strong,
        "noise_a": rng.normal(0, 1, n),
        "noise_b": rng.normal(0, 1, n),
    }, target)
    result = forward_add_with_ci_gate(
        df, target_col="target",
        ranked_features=["strong", "noise_a", "noise_b"],
        bar=StrictBar(ic_min=0.15, hit_min=0.60, spread_min=0.04, mono_freq_min=0.95, k_max=12),
        n_bootstrap=200,
    )
    assert result.k == 1
    assert result.selected == ["strong"]


def test_returns_k_zero_when_bar_unreachable_on_pure_noise():
    rng = np.random.default_rng(0)
    n = 8000
    target = rng.normal(0, 1, n)
    df = _panel({
        "noise_a": rng.normal(0, 1, n),
        "noise_b": rng.normal(0, 1, n),
        "noise_c": rng.normal(0, 1, n),
    }, target)
    result = forward_add_with_ci_gate(
        df, target_col="target",
        ranked_features=["noise_a", "noise_b", "noise_c"],
        bar=StrictBar(ic_min=0.15, hit_min=0.60, spread_min=0.04, mono_freq_min=0.95, k_max=12),
        n_bootstrap=200,
    )
    assert result.k == 0
    assert result.shipped is False
