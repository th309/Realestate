"""Build per-geo-level feature panels for monolithic score discovery.

One parquet per level: rows = (location_id, month), columns = cross-sectional
z-scores of every candidate feature + the excess_3y target (own 3Y forward
annualized ZHVI return minus the location's state return).

Candidates are restricted to sources with full coverage at metro AND county
AND zip, Redfin excluded (see docs/superpowers/specs/
2026-06-12-monolithic-score-feature-discovery-design.md).

Usage:
    python build_panels.py --level metro
    python build_panels.py --level all
"""

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from db import get_engine

DATA_DIR = Path(__file__).parent / "data"

# Vintages where the 3Y forward outcome is fully observable.
VINTAGE_START = "2016-07"
VINTAGE_END = "2023-01"

# Realtor.com: identical column names at every level; _yy columns are
# Realtor's own precomputed year-over-year changes.
REALTOR_FEATURES = [
    "median_days_on_market",
    "median_days_on_market_yy",
    "price_reduced_share",
    "price_reduced_share_yy",
    "price_increased_share",
    "pending_ratio",
    "pending_ratio_yy",
    "active_listing_count_yy",
    "new_listing_count_yy",
    "total_listing_count_yy",
    "median_listing_price_yy",
]

ZILLOW_METRICS = ["zhvi", "inventory", "new_listings"]

# Minimum locations in a month for cross-sectional z-scores to mean anything.
MIN_CROSS_SECTION = 30

LEVELS = {
    "metro": {
        "realtor_table": "realtor_metro",
        "realtor_id": "cbsa_code",
        "zillow_table": "zillow_metro",
        "zillow_id": "cbsa_code",
    },
    "county": {
        "realtor_table": "realtor_county",
        "realtor_id": "county_fips",
        "zillow_table": "zillow_county",
        "zillow_id": "fips_code",
    },
    "zip": {
        "realtor_table": "realtor_zip",
        "realtor_id": "postal_code",
        "zillow_table": "zillow_zip",
        # region_id is Zillow-internal; the postal code lives in region_name.
        "zillow_id": "lpad(region_name, 5, '0')",
    },
}


def load_realtor(engine, level: str) -> pd.DataFrame:
    cfg = LEVELS[level]
    cols = ", ".join(REALTOR_FEATURES)
    sql = f"""
        SELECT {cfg['realtor_id']} AS location_id, period_date, {cols}
        FROM {cfg['realtor_table']}
        WHERE period_date >= '2016-07-01'
    """
    chunks = pd.read_sql(sql, engine, chunksize=200_000)
    df = pd.concat(chunks, ignore_index=True)
    df["month"] = pd.to_datetime(df["period_date"]).dt.to_period("M")
    df = df.drop(columns=["period_date"])
    for col in REALTOR_FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce").astype("float32")
    # A handful of duplicate (location, month) rows exist; keep the last.
    df = df.drop_duplicates(subset=["location_id", "month"], keep="last")
    return df


def load_zillow_derived(engine, level: str) -> pd.DataFrame:
    """Pull raw zhvi/inventory/new_listings and derive momentum features.

    calculated_metrics is stale (derived columns unpopulated for 12+ months),
    so every derivation here is computed fresh from the raw series.
    """
    cfg = LEVELS[level]
    sql = f"""
        SELECT {cfg['zillow_id']} AS location_id, period_date, metric_name, value
        FROM {cfg['zillow_table']}
        WHERE metric_name IN ('zhvi', 'inventory', 'new_listings')
          AND period_date >= '2014-06-01'
    """
    chunks = pd.read_sql(sql, engine, chunksize=500_000)
    df = pd.concat(chunks, ignore_index=True)
    df["month"] = pd.to_datetime(df["period_date"]).dt.to_period("M")
    df["value"] = pd.to_numeric(df["value"], errors="coerce").astype("float64")

    wide = {}
    for metric in ZILLOW_METRICS:
        sub = df[df["metric_name"] == metric]
        wide[metric] = sub.pivot_table(
            index="month", columns="location_id", values="value", aggfunc="last"
        ).sort_index()

    zhvi = wide["zhvi"]
    inv = wide["inventory"]
    nl = wide["new_listings"].rolling(3, min_periods=2).mean()

    derived = {
        "zhvi_yoy": zhvi.pct_change(12, fill_method=None),
        "zhvi_mom_3m": zhvi.pct_change(3, fill_method=None),
        "inventory_yoy": inv.pct_change(12, fill_method=None),
        "new_listings_yoy": nl.pct_change(12, fill_method=None),
    }
    derived["zhvi_accel"] = derived["zhvi_yoy"] - derived["zhvi_yoy"].shift(12)

    frames = []
    for name, mat in derived.items():
        long = mat.stack().rename(name).astype("float32")
        frames.append(long)
    out = pd.concat(frames, axis=1).reset_index()
    out.columns = ["month", "location_id", *derived.keys()]
    return out


def load_target(engine, level: str) -> pd.DataFrame:
    own = pd.read_sql(
        f"""
        SELECT location_id, period_date, return_3y_ann
        FROM zhvi_forward_returns
        WHERE geography_level = '{level}'
          AND period_date >= '2016-06-01' AND return_3y_ann IS NOT NULL
        """,
        engine,
    )
    state = pd.read_sql(
        """
        SELECT location_id AS state_code, period_date, return_3y_ann AS state_return
        FROM zhvi_forward_returns
        WHERE geography_level = 'state'
          AND period_date >= '2016-06-01' AND return_3y_ann IS NOT NULL
        """,
        engine,
    )
    geo_map = pd.read_sql(
        f"""
        SELECT location_id, state_code FROM score_geo_state_map
        WHERE geography = '{level}'
        """,
        engine,
    )
    own["month"] = pd.to_datetime(own["period_date"]).dt.to_period("M")
    state["month"] = pd.to_datetime(state["period_date"]).dt.to_period("M")
    df = own.merge(geo_map, on="location_id", how="inner").merge(
        state[["state_code", "month", "state_return"]],
        on=["state_code", "month"],
        how="inner",
    )
    df["excess_3y"] = (df["return_3y_ann"] - df["state_return"]).astype("float32")
    return df[["location_id", "month", "excess_3y"]]


def zscore_within_month(df: pd.DataFrame, features: list[str]) -> pd.DataFrame:
    grouped = df.groupby("month")
    for col in features:
        mean = grouped[col].transform("mean")
        std = grouped[col].transform("std")
        n = grouped[col].transform("count")
        z = (df[col] - mean) / std
        z[(n < MIN_CROSS_SECTION) | (std == 0)] = np.nan
        df[f"z_{col}"] = z.astype("float32")
    return df.drop(columns=features)


def build_level(level: str) -> None:
    engine = get_engine()
    print(f"[{level}] loading realtor…")
    realtor = load_realtor(engine, level)
    print(f"[{level}]   realtor rows={len(realtor):,} locations={realtor['location_id'].nunique():,}")

    print(f"[{level}] loading zillow + deriving…")
    zillow = load_zillow_derived(engine, level)
    print(f"[{level}]   zillow rows={len(zillow):,} locations={zillow['location_id'].nunique():,}")

    print(f"[{level}] loading target…")
    target = load_target(engine, level)
    print(f"[{level}]   target rows={len(target):,} locations={target['location_id'].nunique():,}")

    panel = target.merge(realtor, on=["location_id", "month"], how="left").merge(
        zillow, on=["location_id", "month"], how="left"
    )
    panel = panel[
        (panel["month"] >= pd.Period(VINTAGE_START))
        & (panel["month"] <= pd.Period(VINTAGE_END))
    ].copy()

    features = REALTOR_FEATURES + [
        "zhvi_yoy", "zhvi_mom_3m", "zhvi_accel", "inventory_yoy", "new_listings_yoy",
    ]
    coverage = {
        col: round(100 * panel[col].notna().mean(), 1) for col in features
    }
    print(f"[{level}] feature coverage % of target rows: {coverage}")

    panel = zscore_within_month(panel, features)

    DATA_DIR.mkdir(exist_ok=True)
    out = DATA_DIR / f"panel_{level}.parquet"
    panel["month"] = panel["month"].dt.to_timestamp()
    panel.to_parquet(out, index=False)
    print(f"[{level}] wrote {out} rows={len(panel):,}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", choices=[*LEVELS, "all"], required=True)
    args = parser.parse_args()
    levels = list(LEVELS) if args.level == "all" else [args.level]
    for lvl in levels:
        build_level(lvl)
