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
    # Build 40 months of continuous data (to support 36-month forward returns)
    panel_rows = []
    for region in [f"CA-{i:03d}" for i in range(10)]:
        for month in range(40):
            date = pd.Timestamp("2020-01-01") + pd.DateOffset(months=month)
            # Each region has slightly different growth to create different returns
            region_idx = int(region.split("-")[1])
            zhvi_value = 100 * (1 + month * 0.01 + region_idx * 0.001)
            panel_rows.append((region, date, zhvi_value))

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

    # Should have excess returns for the first 4 months (which have t+36 observations)
    assert len(ex) > 0
    # All should have peer_tier=1 (state level, since n_state=5 >= threshold 5)
    assert (ex["peer_tier"] == 1).all()


def test_forward_return_handles_month_end_dates():
    """Regression: previous self-join implementation silently dropped rows
    when period_date used month-end dates instead of first-of-month."""
    rows = []
    for region in ["A", "B"]:
        # All month-end dates over 37 months starting 2020-01-31
        start = pd.Timestamp("2020-01-31")
        for i in range(37):
            d = start + pd.DateOffset(months=i)
            rows.append((region, d, 100 + i))
    panel = _zhvi_panel(rows)
    fr = compute_forward_returns(panel, horizon_months=36)
    # Row at 2020-01-31 should have a return_3y (zhvi=100 at t0, =136 at t+36)
    val = fr[(fr["region_id"] == "A") & (fr["period_date"] == pd.Timestamp("2020-01-31"))]["return_3y"]
    assert len(val) == 1
    assert abs(val.iloc[0] - 0.36) < 1e-9


def test_forward_return_drops_rows_with_no_future_observation():
    """A market's last 36 months should have NaN forward return and be dropped."""
    rows = [(f"A", pd.Timestamp(f"2020-{m:02d}-01"), 100 + m) for m in range(1, 13)]
    panel = _zhvi_panel(rows)
    fr = compute_forward_returns(panel, horizon_months=36)
    # No row has a valid t+36 observation, so output should be empty
    assert len(fr) == 0
