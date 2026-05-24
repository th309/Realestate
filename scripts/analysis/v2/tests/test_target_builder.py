"""Tests for excess-return target construction.

The target is excess_3y = own_return_3y - peer_return_3y, where peer_return_3y
is averaged over whatever cascade tier the market falls into.
"""

import numpy as np
import pandas as pd

from scripts.analysis.v2.peer_cascade import build_peer_index
from scripts.analysis.v2.target_builder import compute_forward_returns, compute_excess


def _zhvi_panel(values):
    df = pd.DataFrame(values, columns=["region_id", "period_date", "zhvi"])
    df["period_date"] = pd.to_datetime(df["period_date"])
    return df


def test_forward_return_is_simple_pct_change_over_36_months():
    rows = []
    for region in ["A", "B"]:
        for i in range(37):
            rows.append((region, f"2020-{(i % 12) + 1:02d}-01" if i < 12 else f"{2020 + i // 12}-{(i % 12) + 1:02d}-01", 100 + i))
    panel = _zhvi_panel(rows)
    fr = compute_forward_returns(panel, horizon_months=36)
    val = fr[(fr["region_id"] == "A") & (fr["period_date"] == pd.Timestamp("2020-01-01"))]["return_3y"].iloc[0]
    assert abs(val - 0.36) < 1e-9


def test_excess_is_own_return_minus_peer_mean():
    panel_rows = [(f"CA-{i:03d}", "2020-01-01", 100) for i in range(10)]
    panel_rows += [(f"CA-{i:03d}", "2023-01-01", 100 * (1 + (i + 1) / 10)) for i in range(10)]
    panel = _zhvi_panel(panel_rows)
    fr = compute_forward_returns(panel, horizon_months=36)

    geos = pd.DataFrame({
        "region_id": [f"CA-{i:03d}" for i in range(10)],
        "state_abbrev": ["CA"] * 10,
        "division": ["Pacific"] * 10,
        "region": ["West"] * 10,
        "period_date": pd.to_datetime(["2020-01-01"] * 10),
    })
    idx = build_peer_index(geos, n_state=5, n_division=20, n_region=40)
    ex = compute_excess(fr, idx, horizon_months=36)

    e_000 = ex[(ex["region_id"] == "CA-000") & (ex["period_date"] == pd.Timestamp("2020-01-01"))]["excess_3y"].iloc[0]
    assert abs(e_000 - (0.10 - 0.55)) < 1e-9
    assert (ex["peer_tier"] == 1).all()
