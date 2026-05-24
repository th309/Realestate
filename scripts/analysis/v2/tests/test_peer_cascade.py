"""Tests for the peer-set cascade resolver.

The resolver answers: given a market (g, t, geo_level), what's the
peer set we should rank it within? The cascade is:
  tier 1: state          (if state has >= N_state markets that period)
  tier 2: census division (if division has >= N_division markets)
  tier 3: census region   (if region has >= N_region markets)
  tier 4: national        (always — final fallback)
"""

import pandas as pd
import pytest

from scripts.analysis.v2.peer_cascade import resolve_peer_tier, build_peer_index


def _df(rows):
    return pd.DataFrame(rows, columns=["region_id", "state_abbrev", "division", "region", "period_date"])


def test_returns_tier_1_when_state_has_enough_markets():
    panel = _df([
        (f"CA-{i:03d}", "CA", "Pacific", "West", "2024-01-01") for i in range(15)
    ])
    panel["period_date"] = pd.to_datetime(panel["period_date"])
    idx = build_peer_index(panel, n_state=10, n_division=20, n_region=40)
    tier, peer_key = resolve_peer_tier("CA-000", pd.Timestamp("2024-01-01"), idx)
    assert tier == 1
    assert peer_key == ("state", "CA")


def test_falls_back_to_division_when_state_too_small():
    panel = _df(
        [(f"RI-{i:03d}", "RI", "New England", "Northeast", "2024-01-01") for i in range(5)]
        + [(f"MA-{i:03d}", "MA", "New England", "Northeast", "2024-01-01") for i in range(20)]
    )
    panel["period_date"] = pd.to_datetime(panel["period_date"])
    idx = build_peer_index(panel, n_state=10, n_division=20, n_region=40)
    tier, peer_key = resolve_peer_tier("RI-000", pd.Timestamp("2024-01-01"), idx)
    assert tier == 2
    assert peer_key == ("division", "New England")


def test_falls_back_to_region_when_division_too_small():
    panel = _df(
        [(f"HI-{i:03d}", "HI", "Pacific", "West", "2024-01-01") for i in range(5)]
        + [(f"CA-{i:03d}", "CA", "Pacific", "West", "2024-01-01") for i in range(8)]
        + [(f"WA-{i:03d}", "WA", "Pacific", "West", "2024-01-01") for i in range(8)]
        + [(f"AZ-{i:03d}", "AZ", "Mountain", "West", "2024-01-01") for i in range(25)]
    )
    panel["period_date"] = pd.to_datetime(panel["period_date"])
    idx = build_peer_index(panel, n_state=10, n_division=30, n_region=40)
    tier, peer_key = resolve_peer_tier("HI-000", pd.Timestamp("2024-01-01"), idx)
    assert tier == 3
    assert peer_key == ("region", "West")


def test_falls_back_to_national_when_everything_too_small():
    panel = _df([("X-001", "XX", "FakeDiv", "FakeReg", "2024-01-01")])
    panel["period_date"] = pd.to_datetime(panel["period_date"])
    idx = build_peer_index(panel, n_state=10, n_division=20, n_region=40)
    tier, peer_key = resolve_peer_tier("X-001", pd.Timestamp("2024-01-01"), idx)
    assert tier == 4
    assert peer_key == ("national", "US")


def test_unknown_region_id_raises():
    panel = _df([("A-001", "CA", "Pacific", "West", "2024-01-01")])
    panel["period_date"] = pd.to_datetime(panel["period_date"])
    idx = build_peer_index(panel, n_state=10, n_division=20, n_region=40)
    with pytest.raises(KeyError):
        resolve_peer_tier("Z-999", pd.Timestamp("2024-01-01"), idx)
