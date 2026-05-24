"""Forward-return + excess-return computation.

excess_<H>(g, t) = own_return - peer_return where peer_return is the mean
forward return over the cascade-resolved peer set for (g, t).
"""

import pandas as pd

from scripts.analysis.v2.peer_cascade import PeerIndex, resolve_peer_tier


def compute_forward_returns(zhvi_panel: pd.DataFrame, *, horizon_months: int) -> pd.DataFrame:
    """Take a long ZHVI panel and emit per (region_id, period_date) a forward return.

    Uses positional shift via pivot_table — robust to month-day variation in the
    period_date column.

    Input: columns region_id, period_date, zhvi (one row per (region, period)).
    Output: columns region_id, period_date, zhvi_t0, zhvi_t<H>, return_<H>.
    """
    if horizon_months not in (12, 36):
        raise ValueError("Use horizon_months=12 or 36")

    label = {12: "1y", 36: "3y"}[horizon_months]
    piv = zhvi_panel.pivot_table(index="period_date", columns="region_id", values="zhvi")
    piv = piv.sort_index()  # ensure chronological order so positional shift is correct
    shifted = piv.shift(-horizon_months)
    ret = (shifted / piv) - 1.0

    out = ret.stack().rename(f"return_{label}").reset_index()
    out_t0 = piv.stack().rename("zhvi_t0").reset_index()
    out_tH = shifted.stack().rename(f"zhvi_t{horizon_months}").reset_index()
    merged = (
        out_t0
        .merge(out_tH, on=["period_date", "region_id"])
        .merge(out, on=["period_date", "region_id"])
    )
    return merged.dropna(subset=[f"return_{label}"])


def compute_excess(returns_df: pd.DataFrame, idx: PeerIndex, *, horizon_months: int) -> pd.DataFrame:
    """Attach peer_tier, peer_mean_return, and excess_<H> to each row."""
    label = "1y" if horizon_months == 12 else "3y"
    ret_col = f"return_{label}"

    # Vectorized peer-tier resolution.
    # idx.labels is a (region_id, period_date) -> (state_abbrev, division, region) frame.
    labels = idx.labels.reset_index()
    rows = returns_df[["region_id", "period_date"]].drop_duplicates().merge(
        labels, on=["region_id", "period_date"], how="inner"
    )

    # idx.counts is a multiindex Series keyed by (period_date, level, group_key) -> n.
    counts = idx.counts  # period_date, level, group_key
    state_counts = counts.xs("state", level="level").rename("n_state")
    div_counts = counts.xs("division", level="level").rename("n_division")
    reg_counts = counts.xs("region", level="level").rename("n_region")

    rows = rows.merge(
        state_counts.reset_index().rename(columns={"group_key": "state_abbrev"}),
        on=["period_date", "state_abbrev"], how="left",
    ).merge(
        div_counts.reset_index().rename(columns={"group_key": "division"}),
        on=["period_date", "division"], how="left",
    ).merge(
        reg_counts.reset_index().rename(columns={"group_key": "region"}),
        on=["period_date", "region"], how="left",
    )
    rows[["n_state", "n_division", "n_region"]] = rows[["n_state", "n_division", "n_region"]].fillna(0).astype(int)

    # Tier: 1 if state count >= threshold, else 2 if division, else 3 if region, else 4
    rows["peer_tier"] = 4
    rows.loc[rows["n_region"] >= idx.n_region, "peer_tier"] = 3
    rows.loc[rows["n_division"] >= idx.n_division, "peer_tier"] = 2
    rows.loc[rows["n_state"] >= idx.n_state, "peer_tier"] = 1

    rows["peer_level"] = rows["peer_tier"].map({1: "state", 2: "division", 3: "region", 4: "national"})
    rows["peer_key"] = rows.apply(
        lambda r: str(r["state_abbrev"]) if r["peer_tier"] == 1
        else str(r["division"]) if r["peer_tier"] == 2
        else str(r["region"]) if r["peer_tier"] == 3
        else "US",
        axis=1,
    )
    rows = rows[["region_id", "period_date", "peer_tier", "peer_level", "peer_key"]]
    rows["peer_key"] = rows["peer_key"].astype(str)

    annotated = returns_df.merge(rows, on=["region_id", "period_date"])

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
    all_means["peer_key"] = all_means["peer_key"].astype(str)

    annotated = annotated.merge(
        all_means, on=["period_date", "peer_level", "peer_key"], how="left"
    )
    annotated[f"excess_{label}"] = annotated[ret_col] - annotated["peer_mean"]
    return annotated
