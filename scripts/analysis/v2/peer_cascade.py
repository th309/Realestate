"""Peer-set cascade resolver for PropertyIQ Score V2.

Markets in small states (e.g. RI with 5 counties) can't be reliably scored
against just their state. The cascade evaluates: state → Census division →
Census region → national, picking the first tier with enough peers.

Thresholds N_state / N_division / N_region are calibrated empirically in P1.
"""

from dataclasses import dataclass

import pandas as pd

NATIONAL_KEY = ("national", "US")


@dataclass
class PeerIndex:
    """Resolved peer assignments + per-period counts for every market."""
    labels: pd.DataFrame
    counts: pd.Series
    n_state: int
    n_division: int
    n_region: int


def build_peer_index(panel: pd.DataFrame, *, n_state: int, n_division: int, n_region: int) -> PeerIndex:
    """Pre-compute per-period peer counts at every cascade tier.

    `panel` must have columns: region_id, state_abbrev, division, region, period_date.
    Returns a PeerIndex you pass to resolve_peer_tier().
    """
    required = {"region_id", "state_abbrev", "division", "region", "period_date"}
    missing = required - set(panel.columns)
    if missing:
        raise ValueError(f"panel missing columns: {missing}")

    labels = panel.set_index("region_id")[["state_abbrev", "division", "region", "period_date"]]

    state_counts = (
        panel.groupby(["period_date", "state_abbrev"], observed=True).size().rename("n")
    )
    div_counts = (
        panel.groupby(["period_date", "division"], observed=True).size().rename("n")
    )
    reg_counts = (
        panel.groupby(["period_date", "region"], observed=True).size().rename("n")
    )

    state_counts = state_counts.reset_index().assign(level="state").rename(columns={"state_abbrev": "group_key"})
    div_counts = div_counts.reset_index().assign(level="division").rename(columns={"division": "group_key"})
    reg_counts = reg_counts.reset_index().assign(level="region").rename(columns={"region": "group_key"})
    combined = pd.concat([state_counts, div_counts, reg_counts], ignore_index=True)
    counts = combined.set_index(["period_date", "level", "group_key"])["n"]

    return PeerIndex(
        labels=labels, counts=counts,
        n_state=n_state, n_division=n_division, n_region=n_region,
    )


def resolve_peer_tier(region_id: str, period_date: pd.Timestamp, idx: PeerIndex) -> tuple[int, tuple[str, str]]:
    """Resolve which cascade tier and peer key applies to (region_id, period_date).

    Returns (tier, (level, group_key)) where tier in {1,2,3,4}.
    Tier 4 ('national', 'US') is the always-available fallback.

    Raises KeyError if region_id is not in the panel.
    """
    if region_id not in idx.labels.index:
        raise KeyError(f"region_id {region_id!r} not in peer index")

    row = idx.labels.loc[region_id]
    if isinstance(row, pd.DataFrame):
        row = row[row["period_date"] == period_date].iloc[0]

    state, division, region = row["state_abbrev"], row["division"], row["region"]

    def count_at(level: str, key: str) -> int:
        try:
            return int(idx.counts.loc[(period_date, level, key)])
        except KeyError:
            return 0

    if count_at("state", state) >= idx.n_state:
        return 1, ("state", state)
    if count_at("division", division) >= idx.n_division:
        return 2, ("division", division)
    if count_at("region", region) >= idx.n_region:
        return 3, ("region", region)
    return 4, NATIONAL_KEY
