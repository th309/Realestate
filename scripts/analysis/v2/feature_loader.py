"""Feature panel loader for PropertyIQ Score V2.

Path A: Reads pre-dumped Parquet panels and merges them into a unified
(region_id, period_date) wide DataFrame. Annual sources are forward-filled
per region with a 13-month staleness cap.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import pandas as pd

GeoLevel = Literal["metro", "county", "zip", "state"]

DEFAULT_DATA_DIR = Path(__file__).parent / "data"

# Source definitions: (source_name, parquet_file_prefix)
# Geo-level filters specify which levels support each source

MONTHLY_SOURCES = [
    ("rfdc_housing_market", {"metro", "county", "zip", "state"}),
    ("rfdc_price_drops", {"metro", "county", "zip", "state"}),
    ("rfdc_contract_cancellations", {"metro", "county", "zip", "state"}),
    ("rfdc_delistings", {"metro", "county", "zip", "state"}),
    ("rfdc_investors", {"metro"}),
    ("rfdc_cash_loan", {"metro"}),
    ("rfdc_buyers_sellers", {"metro"}),
    ("rfdc_rhpi", {"metro"}),
    ("rfdc_migration", {"metro"}),
    ("zillow", {"metro", "county", "zip", "state"}),
    ("realtor", {"metro", "county", "zip", "state"}),
    ("economic", {"metro", "county", "zip", "state"}),
    ("permits", {"county", "state"}),
]

ANNUAL_SOURCES = [
    ("hud_fmr", {"metro", "county"}),
    ("irs_migration", {"county"}),
    ("census", {"metro", "county", "zip", "state"}),
]


@dataclass
class FeaturePanel:
    df: pd.DataFrame
    feature_cols: list[str]


def load_feature_panel(geo_level: GeoLevel, *, data_dir: Path = DEFAULT_DATA_DIR) -> FeaturePanel:
    """Read pre-dumped Parquet panels for the given geo level and merge into
    a unified (region_id, period_date) wide DataFrame.

    Sources expected per geo level (see file naming below). Sources missing
    from disk are skipped silently — supported geo coverage varies per spec §5.
    Annual sources are forward-filled per region_id with a 13-month staleness cap.

    Raises FileNotFoundError if NO source files exist for the geo level.
    """
    data_dir = Path(data_dir)

    # Collect available monthly and annual source files
    monthly_dfs = []
    annual_cols_by_source = {}  # Track which columns came from annual sources

    # Load monthly sources
    for source_name, supported_geos in MONTHLY_SOURCES:
        if geo_level not in supported_geos:
            continue

        file_path = data_dir / f"{source_name}_{geo_level}.parquet"
        if not file_path.exists():
            continue

        df = pd.read_parquet(file_path)
        # Ensure period_date is datetime
        if "period_date" in df.columns:
            df["period_date"] = pd.to_datetime(df["period_date"])
        monthly_dfs.append(df)

    # Load annual sources
    annual_dfs = []
    for source_name, supported_geos in ANNUAL_SOURCES:
        if geo_level not in supported_geos:
            continue

        file_path = data_dir / f"{source_name}_{geo_level}.parquet"
        if not file_path.exists():
            continue

        df = pd.read_parquet(file_path)
        # Ensure period_date is datetime
        if "period_date" in df.columns:
            df["period_date"] = pd.to_datetime(df["period_date"])

        # Track which columns are annual (all non-index columns)
        annual_cols = [c for c in df.columns if c not in {"region_id", "period_date"}]
        annual_cols_by_source[source_name] = annual_cols
        annual_dfs.append(df)

    # Raise error if no sources at all
    if not monthly_dfs and not annual_dfs:
        raise FileNotFoundError(
            f"No feature source files found in {data_dir} for geo_level={geo_level}"
        )

    # Merge monthly sources
    if monthly_dfs:
        result = monthly_dfs[0]
        for df in monthly_dfs[1:]:
            result = pd.merge(
                result,
                df,
                on=["region_id", "period_date"],
                how="outer",
            )
    else:
        # Start with first annual source if no monthly sources
        result = annual_dfs[0]
        annual_dfs = annual_dfs[1:]

    # Merge annual sources
    for df in annual_dfs:
        result = pd.merge(
            result,
            df,
            on=["region_id", "period_date"],
            how="outer",
        )

    # Sort by region_id and period_date
    result = result.sort_values(["region_id", "period_date"]).reset_index(drop=True)

    # Forward-fill annual columns per region with limit=13
    if annual_cols_by_source:
        all_annual_cols = []
        for cols in annual_cols_by_source.values():
            all_annual_cols.extend(cols)

        # Forward-fill: group by region_id, fill only annual columns with limit=13
        result[all_annual_cols] = result.groupby("region_id")[all_annual_cols].ffill(limit=13)

    # Extract feature columns (all columns except region_id and period_date)
    feature_cols = [c for c in result.columns if c not in {"region_id", "period_date"}]

    return FeaturePanel(df=result, feature_cols=feature_cols)
