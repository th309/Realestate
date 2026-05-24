"""Forward-return + excess-return computation.

excess_<H>(g, t) = own_return - peer_return where peer_return is the mean
forward return over the cascade-resolved peer set for (g, t).
"""

import pandas as pd

from scripts.analysis.v2.peer_cascade import PeerIndex, resolve_peer_tier


def compute_forward_returns(zhvi_panel: pd.DataFrame, *, horizon_months: int) -> pd.DataFrame:
    """Take a long ZHVI panel and emit per (region_id, period_date) a forward return.

    Input: columns region_id, period_date, zhvi.
    Output: columns region_id, period_date, zhvi_t0, zhvi_t<H>, return_<H>.

    Matches forward-looking values by calendar date (period_date + horizon_months),
    not by row position.
    """
    if horizon_months not in (12, 36):
        raise ValueError("Use horizon_months=12 or 36")

    label = "1y" if horizon_months == 12 else "3y"

    # Self-join to match current values with forward-looking values
    zhvi_panel = zhvi_panel.copy()

    # Current values: (region_id, period_date, zhvi_t0)
    current = zhvi_panel[["region_id", "period_date", "zhvi"]].rename(
        columns={"zhvi": "zhvi_t0"}
    )

    # Future values: (region_id, lookup_date, zhvi_tH)
    # where lookup_date = current period_date + horizon_months
    future = zhvi_panel[["region_id", "period_date", "zhvi"]].rename(
        columns={"zhvi": f"zhvi_t{horizon_months}"}
    )
    future["lookup_date"] = future["period_date"] - pd.DateOffset(months=horizon_months)

    # Merge: current period_date = future lookup_date
    merged = current.merge(
        future[["region_id", "lookup_date", f"zhvi_t{horizon_months}"]],
        left_on=["region_id", "period_date"],
        right_on=["region_id", "lookup_date"],
        how="inner"
    ).drop(columns=["lookup_date"])

    # Compute return
    merged[f"return_{label}"] = (merged[f"zhvi_t{horizon_months}"] / merged["zhvi_t0"]) - 1.0

    return merged[[
        "region_id", "period_date", "zhvi_t0", f"zhvi_t{horizon_months}", f"return_{label}"
    ]].dropna(subset=[f"return_{label}"])


def compute_excess(returns_df: pd.DataFrame, idx: PeerIndex, *, horizon_months: int) -> pd.DataFrame:
    """Attach peer_tier, peer_mean_return, and excess_<H> to each row."""
    label = "1y" if horizon_months == 12 else "3y"
    ret_col = f"return_{label}"

    rows = returns_df[["region_id", "period_date"]].drop_duplicates().reset_index(drop=True)
    resolved = rows.apply(
        lambda r: resolve_peer_tier(r["region_id"], r["period_date"], idx),
        axis=1,
    )
    rows["peer_tier"] = resolved.apply(lambda x: x[0])
    rows["peer_level"] = resolved.apply(lambda x: x[1][0])
    rows["peer_key"] = resolved.apply(lambda x: x[1][1])

    annotated = returns_df.merge(rows, on=["region_id", "period_date"])

    labels = idx.labels.reset_index()  # has region_id, period_date, state_abbrev, division, region

    def peer_mean_for_level(level: str) -> pd.Series:
        key_col = {"state": "state_abbrev", "division": "division", "region": "region"}[level]
        with_key = returns_df.merge(
            labels[["region_id", "period_date", key_col]],
            on=["region_id", "period_date"],
        )
        return with_key.groupby(["period_date", key_col])[ret_col].mean().rename("peer_mean")

    state_means = peer_mean_for_level("state").reset_index().rename(columns={"state_abbrev": "peer_key"}).assign(peer_level="state")
    div_means = peer_mean_for_level("division").reset_index().rename(columns={"division": "peer_key"}).assign(peer_level="division")
    reg_means = peer_mean_for_level("region").reset_index().rename(columns={"region": "peer_key"}).assign(peer_level="region")
    nat_means = returns_df.groupby("period_date")[ret_col].mean().rename("peer_mean").reset_index().assign(peer_level="national", peer_key="US")
    all_means = pd.concat([state_means, div_means, reg_means, nat_means], ignore_index=True)

    annotated = annotated.merge(
        all_means, on=["period_date", "peer_level", "peer_key"], how="left"
    )
    annotated[f"excess_{label}"] = annotated[ret_col] - annotated["peer_mean"]
    return annotated
