"""
Export Backtest Data

Exports database data to Parquet files for ML processing:
- geographies.parquet - All geographies with attributes
- zillow_historical.parquet - Full Zillow time series
- census_latest.parquet - Census ACS data
- economic.parquet - Economic indicators

Usage:
    python export_backtest_data.py
"""

import os
import sys
from datetime import datetime
import pandas as pd

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import query_to_df, report_progress, get_output_dir


def export_geographies() -> pd.DataFrame:
    """Export all geographies with attributes."""
    report_progress(5, "Exporting geographies...")

    sql = """
    SELECT
        g.geography_id,
        g.geography_type,
        g.name,
        g.state_code,
        g.state_name,
        g.metro_id,
        g.metro_name,
        g.county_fips,
        g.county_name,
        g.latitude,
        g.longitude,
        g.population,
        g.land_area_sq_miles,
        g.region,
        g.division
    FROM geographies g
    WHERE g.geography_type IN ('zip', 'county', 'metro', 'state')
    """

    df = query_to_df(sql)
    print(f"  Exported {len(df):,} geographies")
    return df


def export_zillow_historical() -> pd.DataFrame:
    """Export full Zillow time series data."""
    report_progress(20, "Exporting Zillow historical data...")

    sql = """
    SELECT
        geography_id,
        date,
        zhvi,
        zhvi_yoy,
        zori,
        zori_yoy,
        zhvf_1yr,
        inventory,
        days_on_market,
        list_price,
        sale_price,
        pending_ratio,
        new_listings,
        price_cuts
    FROM zillow_timeseries
    WHERE date >= '2015-01-01'
    ORDER BY geography_id, date
    """

    df = query_to_df(sql)
    print(f"  Exported {len(df):,} Zillow time series rows")
    return df


def export_census_latest() -> pd.DataFrame:
    """Export latest Census ACS data."""
    report_progress(50, "Exporting Census data...")

    sql = """
    SELECT
        geography_id,
        year,
        total_population,
        median_household_income,
        median_age,
        owner_occupied_pct,
        renter_occupied_pct,
        vacancy_rate,
        median_home_value,
        median_gross_rent,
        poverty_rate,
        unemployment_rate,
        bachelors_degree_pct,
        median_rooms,
        built_2014_or_later_pct,
        built_1939_or_earlier_pct
    FROM census_acs
    WHERE year = (SELECT MAX(year) FROM census_acs)
    """

    df = query_to_df(sql)
    print(f"  Exported {len(df):,} Census records")
    return df


def export_economic() -> pd.DataFrame:
    """Export economic indicators."""
    report_progress(70, "Exporting economic data...")

    sql = """
    SELECT
        geography_id,
        date,
        gdp,
        gdp_growth,
        employment,
        employment_growth,
        unemployment_rate,
        labor_force_participation,
        permits_total,
        permits_single_family,
        permits_multi_family
    FROM economic_indicators
    WHERE date >= '2015-01-01'
    ORDER BY geography_id, date
    """

    df = query_to_df(sql)
    print(f"  Exported {len(df):,} economic indicator rows")
    return df


def main():
    """Main export function."""
    print("=" * 60)
    print("PropertyIQ ML - Data Export")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Ensure output directory exists
    output_dir = get_output_dir()
    os.makedirs(output_dir, exist_ok=True)

    report_progress(0, "Starting data export...")

    # Export each dataset
    exports = [
        ('geographies.parquet', export_geographies),
        ('zillow_historical.parquet', export_zillow_historical),
        ('census_latest.parquet', export_census_latest),
        ('economic.parquet', export_economic),
    ]

    for filename, export_func in exports:
        df = export_func()
        filepath = os.path.join(output_dir, filename)
        df.to_parquet(filepath, index=False)
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        print(f"  Saved {filepath} ({size_mb:.1f} MB)")

    report_progress(100, "Export complete!")

    print("=" * 60)
    print("Export Summary:")
    print(f"  Output directory: {output_dir}")
    for filename, _ in exports:
        filepath = os.path.join(output_dir, filename)
        if os.path.exists(filepath):
            size_mb = os.path.getsize(filepath) / (1024 * 1024)
            print(f"  - {filename}: {size_mb:.1f} MB")
    print("=" * 60)


if __name__ == '__main__':
    main()
