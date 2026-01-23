"""
Export Backtest Data

Exports database data to Parquet files for ML processing:
- geographies.parquet - All geographies with attributes
- zillow_historical.parquet - Full Zillow time series (pivoted from long format)
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

# US Census regions derived from state codes
STATE_TO_REGION = {
    # Northeast - New England
    'CT': 'Northeast', 'ME': 'Northeast', 'MA': 'Northeast',
    'NH': 'Northeast', 'RI': 'Northeast', 'VT': 'Northeast',
    # Northeast - Mid-Atlantic
    'NJ': 'Northeast', 'NY': 'Northeast', 'PA': 'Northeast',
    # Midwest - East North Central
    'IL': 'Midwest', 'IN': 'Midwest', 'MI': 'Midwest',
    'OH': 'Midwest', 'WI': 'Midwest',
    # Midwest - West North Central
    'IA': 'Midwest', 'KS': 'Midwest', 'MN': 'Midwest',
    'MO': 'Midwest', 'NE': 'Midwest', 'ND': 'Midwest', 'SD': 'Midwest',
    # South - South Atlantic
    'DE': 'South', 'DC': 'South', 'FL': 'South', 'GA': 'South',
    'MD': 'South', 'NC': 'South', 'SC': 'South', 'VA': 'South', 'WV': 'South',
    # South - East South Central
    'AL': 'South', 'KY': 'South', 'MS': 'South', 'TN': 'South',
    # South - West South Central
    'AR': 'South', 'LA': 'South', 'OK': 'South', 'TX': 'South',
    # West - Mountain
    'AZ': 'West', 'CO': 'West', 'ID': 'West', 'MT': 'West',
    'NV': 'West', 'NM': 'West', 'UT': 'West', 'WY': 'West',
    # West - Pacific
    'AK': 'West', 'CA': 'West', 'HI': 'West', 'OR': 'West', 'WA': 'West',
    # Territories
    'PR': 'Territories', 'GU': 'Territories', 'VI': 'Territories', 'AS': 'Territories',
}


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
        g.parent_metro_id as metro_id,
        g.cbsa_name as metro_name,
        g.fips_code as county_fips,
        g.county_name,
        g.latitude,
        g.longitude,
        g.population,
        g.land_area_sqmi as land_area_sq_miles,
        g.zillow_region_id,
        g.zillow_metro_region_id
    FROM geographies g
    WHERE g.geography_type IN ('zip', 'county', 'metro', 'state')
    """

    df = query_to_df(sql)

    # Add region based on state code
    df['region'] = df['state_code'].map(STATE_TO_REGION).fillna('Unknown')

    print(f"  Exported {len(df):,} geographies")
    return df


def export_zillow_historical() -> pd.DataFrame:
    """Export full Zillow time series data (pivoted from long format)."""
    report_progress(20, "Exporting Zillow historical data...")

    # Export ZIP-level data (most granular and most common use case)
    # The data is in long format, so we'll pivot it to wide format
    sql = """
    WITH zip_data AS (
        SELECT
            region_id,
            region_name as zip_code,
            state_code,
            period_date as date,
            metric_name,
            value
        FROM zillow_zip
        WHERE period_date >= '2015-01-01'
    )
    SELECT
        zip_code as geography_id,
        'zip' as geography_type,
        date,
        MAX(CASE WHEN metric_name = 'zhvi' THEN value END) as zhvi,
        MAX(CASE WHEN metric_name = 'zhvi_yoy' THEN value END) as zhvi_yoy,
        MAX(CASE WHEN metric_name = 'zori' THEN value END) as zori,
        MAX(CASE WHEN metric_name = 'zori_yoy' THEN value END) as zori_yoy,
        MAX(CASE WHEN metric_name = 'zhvf' THEN value END) as zhvf_1yr,
        MAX(CASE WHEN metric_name = 'inventory' THEN value END) as inventory,
        MAX(CASE WHEN metric_name = 'dom' THEN value END) as days_on_market,
        MAX(CASE WHEN metric_name = 'list_price' THEN value END) as list_price,
        MAX(CASE WHEN metric_name = 'sale_price' THEN value END) as sale_price,
        MAX(CASE WHEN metric_name = 'pending_ratio' THEN value END) as pending_ratio,
        MAX(CASE WHEN metric_name = 'new_listings' THEN value END) as new_listings,
        MAX(CASE WHEN metric_name = 'price_cuts' THEN value END) as price_cuts
    FROM zip_data
    GROUP BY zip_code, date
    ORDER BY zip_code, date
    """

    df_zip = query_to_df(sql)
    print(f"  Exported {len(df_zip):,} ZIP time series rows")

    # Also export metro-level data
    report_progress(35, "Exporting metro Zillow data...")
    sql_metro = """
    WITH metro_data AS (
        SELECT
            cbsa_code,
            region_name,
            period_date as date,
            metric_name,
            value
        FROM zillow_metro
        WHERE period_date >= '2015-01-01'
    )
    SELECT
        cbsa_code as geography_id,
        'metro' as geography_type,
        date,
        MAX(CASE WHEN metric_name = 'zhvi' THEN value END) as zhvi,
        MAX(CASE WHEN metric_name = 'zhvi_yoy' THEN value END) as zhvi_yoy,
        MAX(CASE WHEN metric_name = 'zori' THEN value END) as zori,
        MAX(CASE WHEN metric_name = 'zori_yoy' THEN value END) as zori_yoy,
        MAX(CASE WHEN metric_name = 'zhvf' THEN value END) as zhvf_1yr,
        MAX(CASE WHEN metric_name = 'inventory' THEN value END) as inventory,
        MAX(CASE WHEN metric_name = 'dom' THEN value END) as days_on_market,
        MAX(CASE WHEN metric_name = 'list_price' THEN value END) as list_price,
        MAX(CASE WHEN metric_name = 'sale_price' THEN value END) as sale_price,
        MAX(CASE WHEN metric_name = 'pending_ratio' THEN value END) as pending_ratio,
        MAX(CASE WHEN metric_name = 'new_listings' THEN value END) as new_listings,
        MAX(CASE WHEN metric_name = 'price_cuts' THEN value END) as price_cuts
    FROM metro_data
    GROUP BY cbsa_code, region_name, date
    ORDER BY cbsa_code, date
    """

    df_metro = query_to_df(sql_metro)
    print(f"  Exported {len(df_metro):,} metro time series rows")

    # Combine ZIP and metro data
    df = pd.concat([df_zip, df_metro], ignore_index=True)
    print(f"  Total Zillow time series rows: {len(df):,}")

    return df


def export_census_latest() -> pd.DataFrame:
    """Export latest Census ACS data."""
    report_progress(50, "Exporting Census data...")

    # Export ZIP-level census data
    sql_zip = """
    SELECT
        zcta as geography_id,
        'zip' as geography_type,
        year,
        total_population,
        median_household_income,
        median_age,
        CASE
            WHEN (owner_occupied_units + renter_occupied_units) > 0
            THEN owner_occupied_units::decimal / (owner_occupied_units + renter_occupied_units)
            ELSE NULL
        END as owner_occupied_pct,
        CASE
            WHEN (owner_occupied_units + renter_occupied_units) > 0
            THEN renter_occupied_units::decimal / (owner_occupied_units + renter_occupied_units)
            ELSE NULL
        END as renter_occupied_pct,
        CASE
            WHEN total_housing_units > 0
            THEN (total_housing_units - owner_occupied_units - renter_occupied_units)::decimal / total_housing_units
            ELSE NULL
        END as vacancy_rate,
        median_home_value,
        median_gross_rent
    FROM census_zip
    WHERE year = (SELECT MAX(year) FROM census_zip)
    """

    df_zip = query_to_df(sql_zip)
    print(f"  Exported {len(df_zip):,} ZIP Census records")

    # Export county-level census data
    report_progress(55, "Exporting county Census data...")
    sql_county = """
    SELECT
        fips_code as geography_id,
        'county' as geography_type,
        year,
        total_population,
        median_household_income,
        median_age,
        CASE
            WHEN (owner_occupied_units + renter_occupied_units) > 0
            THEN owner_occupied_units::decimal / (owner_occupied_units + renter_occupied_units)
            ELSE NULL
        END as owner_occupied_pct,
        CASE
            WHEN (owner_occupied_units + renter_occupied_units) > 0
            THEN renter_occupied_units::decimal / (owner_occupied_units + renter_occupied_units)
            ELSE NULL
        END as renter_occupied_pct,
        CASE
            WHEN total_housing_units > 0
            THEN (total_housing_units - owner_occupied_units - renter_occupied_units)::decimal / total_housing_units
            ELSE NULL
        END as vacancy_rate,
        median_home_value,
        median_gross_rent
    FROM census_county
    WHERE year = (SELECT MAX(year) FROM census_county)
    """

    df_county = query_to_df(sql_county)
    print(f"  Exported {len(df_county):,} county Census records")

    # Export metro-level census data
    report_progress(60, "Exporting metro Census data...")
    sql_metro = """
    SELECT
        cbsa_code as geography_id,
        'metro' as geography_type,
        year,
        total_population,
        median_household_income,
        median_age,
        CASE
            WHEN (owner_occupied_units + renter_occupied_units) > 0
            THEN owner_occupied_units::decimal / (owner_occupied_units + renter_occupied_units)
            ELSE NULL
        END as owner_occupied_pct,
        CASE
            WHEN (owner_occupied_units + renter_occupied_units) > 0
            THEN renter_occupied_units::decimal / (owner_occupied_units + renter_occupied_units)
            ELSE NULL
        END as renter_occupied_pct,
        CASE
            WHEN total_housing_units > 0
            THEN (total_housing_units - owner_occupied_units - renter_occupied_units)::decimal / total_housing_units
            ELSE NULL
        END as vacancy_rate,
        median_home_value,
        median_gross_rent
    FROM census_metro
    WHERE year = (SELECT MAX(year) FROM census_metro)
    """

    df_metro = query_to_df(sql_metro)
    print(f"  Exported {len(df_metro):,} metro Census records")

    # Combine all census data
    df = pd.concat([df_zip, df_county, df_metro], ignore_index=True)
    print(f"  Total Census records: {len(df):,}")

    return df


def export_economic() -> pd.DataFrame:
    """Export economic indicators."""
    report_progress(70, "Exporting economic data...")

    # Export county-level economic data
    sql_county = """
    SELECT
        fips_code as geography_id,
        'county' as geography_type,
        period_date as date,
        unemployment_rate,
        gdp_millions as gdp,
        gdp_yoy as gdp_growth,
        total_nonfarm_employment as employment
    FROM economic_county
    WHERE period_date >= '2015-01-01'
    ORDER BY fips_code, period_date
    """

    df_county = query_to_df(sql_county)
    print(f"  Exported {len(df_county):,} county economic rows")

    # Export state-level economic data
    report_progress(80, "Exporting state economic data...")
    sql_state = """
    SELECT
        state_fips as geography_id,
        'state' as geography_type,
        period_date as date,
        unemployment_rate,
        gdp_millions as gdp,
        gdp_yoy as gdp_growth,
        real_gdp_millions as real_gdp,
        total_nonfarm_employment as employment,
        rpp_all_items as cost_of_living_index,
        rpp_housing as housing_cost_index
    FROM economic_state
    WHERE period_date >= '2015-01-01'
    ORDER BY state_fips, period_date
    """

    df_state = query_to_df(sql_state)
    print(f"  Exported {len(df_state):,} state economic rows")

    # Export metro-level economic data
    report_progress(85, "Exporting metro economic data...")
    sql_metro = """
    SELECT
        cbsa_code as geography_id,
        'metro' as geography_type,
        period_date as date,
        unemployment_rate,
        gdp_millions as gdp,
        gdp_yoy as gdp_growth,
        real_gdp_millions as real_gdp,
        total_nonfarm_employment as employment,
        rpp_all_items as cost_of_living_index,
        rpp_housing as housing_cost_index
    FROM economic_metro
    WHERE period_date >= '2015-01-01'
    ORDER BY cbsa_code, period_date
    """

    df_metro = query_to_df(sql_metro)
    print(f"  Exported {len(df_metro):,} metro economic rows")

    # Combine all economic data
    df = pd.concat([df_county, df_state, df_metro], ignore_index=True)
    print(f"  Total economic rows: {len(df):,}")

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
