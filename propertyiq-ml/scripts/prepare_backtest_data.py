"""
Prepare Backtest Data

Creates the backtest dataset by combining:
- Historical scores at various points in time
- Actual outcomes (ZHVI appreciation) for 1Y, 3Y, 5Y horizons

This is a prerequisite for calculate_benchmarks.py.

Usage:
    python prepare_backtest_data.py
    python prepare_backtest_data.py --start-date 2018-01-01 --end-date 2023-01-01
"""

import os
import sys
import argparse
from datetime import datetime
import pandas as pd
import numpy as np

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import report_progress, get_output_dir


def load_parquet(filename: str) -> pd.DataFrame:
    """Load a parquet file from the data directory."""
    filepath = os.path.join(get_output_dir(), filename)
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Required file not found: {filepath}. Run export_backtest_data.py first.")
    return pd.read_parquet(filepath)


def calculate_returns(zillow_df: pd.DataFrame, horizons: list[int] = [12, 36, 60]) -> pd.DataFrame:
    """
    Calculate actual returns for each geography at each date.

    Args:
        zillow_df: DataFrame with zillow historical data
        horizons: List of months to calculate returns for (12=1yr, 36=3yr, 60=5yr)

    Returns:
        DataFrame with columns: geography_id, date, return_1y, return_3y, return_5y
    """
    report_progress(20, "Calculating actual returns...")

    # Ensure date is datetime
    zillow_df['date'] = pd.to_datetime(zillow_df['date'])

    # Sort by geography and date
    zillow_df = zillow_df.sort_values(['geography_id', 'date'])

    # Create a pivot for easier lookup
    zhvi_pivot = zillow_df.pivot_table(
        index='date',
        columns='geography_id',
        values='zhvi',
        aggfunc='first'
    )

    results = []
    dates = zillow_df['date'].unique()

    for i, current_date in enumerate(dates):
        if i % 12 == 0:  # Update progress every 12 dates
            progress = 20 + int((i / len(dates)) * 40)
            report_progress(progress, f"Processing {current_date.strftime('%Y-%m')}...")

        current_zhvi = zhvi_pivot.loc[current_date] if current_date in zhvi_pivot.index else pd.Series()

        row_data = {'date': current_date}

        for months, col_name in [(12, 'return_1y'), (36, 'return_3y'), (60, 'return_5y')]:
            future_date = current_date + pd.DateOffset(months=months)

            # Find closest future date
            future_dates = zhvi_pivot.index[zhvi_pivot.index >= future_date]
            if len(future_dates) > 0:
                actual_future_date = future_dates[0]
                future_zhvi = zhvi_pivot.loc[actual_future_date]

                # Calculate annualized return
                years = months / 12
                returns = ((future_zhvi / current_zhvi) ** (1 / years) - 1) * 100
                row_data[col_name] = returns

        if 'return_1y' in row_data:
            # Unstack to get one row per geography
            for geo_id in current_zhvi.index:
                geo_row = {
                    'geography_id': geo_id,
                    'date': current_date,
                }
                for col in ['return_1y', 'return_3y', 'return_5y']:
                    if col in row_data and geo_id in row_data[col].index:
                        geo_row[col] = row_data[col][geo_id]
                    else:
                        geo_row[col] = np.nan

                results.append(geo_row)

    return pd.DataFrame(results)


def calculate_features(
    zillow_df: pd.DataFrame,
    census_df: pd.DataFrame,
    economic_df: pd.DataFrame,
    geographies_df: pd.DataFrame
) -> pd.DataFrame:
    """
    Calculate feature values at each date for each geography.

    Returns DataFrame with features that would have been available at prediction time.
    """
    report_progress(60, "Calculating features...")

    # Ensure date columns are datetime
    zillow_df['date'] = pd.to_datetime(zillow_df['date'])
    if 'date' in economic_df.columns:
        economic_df['date'] = pd.to_datetime(economic_df['date'])

    # Merge Zillow features
    features = zillow_df[['geography_id', 'date', 'zhvi', 'zhvi_yoy', 'zori',
                          'zori_yoy', 'pending_ratio', 'inventory', 'days_on_market']].copy()

    # Add geography attributes
    features = features.merge(
        geographies_df[['geography_id', 'state_code', 'metro_id', 'population',
                        'land_area_sq_miles', 'region']],
        on='geography_id',
        how='left'
    )

    # Calculate density
    features['density'] = features['population'] / features['land_area_sq_miles'].replace(0, np.nan)

    # Add census features (static per geography)
    features = features.merge(
        census_df[['geography_id', 'median_household_income', 'median_age',
                   'owner_occupied_pct', 'vacancy_rate', 'poverty_rate',
                   'bachelors_degree_pct']],
        on='geography_id',
        how='left'
    )

    report_progress(75, "Features calculated")
    return features


def create_backtest_dataset(
    features_df: pd.DataFrame,
    returns_df: pd.DataFrame
) -> pd.DataFrame:
    """
    Merge features with outcomes to create final backtest dataset.
    """
    report_progress(80, "Creating final dataset...")

    # Merge features with returns
    backtest = features_df.merge(
        returns_df[['geography_id', 'date', 'return_1y', 'return_3y', 'return_5y']],
        on=['geography_id', 'date'],
        how='inner'
    )

    # Remove rows with no outcomes
    backtest = backtest.dropna(subset=['return_1y'])

    # Add price tier based on ZHVI
    def get_price_tier(zhvi):
        if pd.isna(zhvi):
            return None
        if zhvi < 150000:
            return 'P1'
        elif zhvi < 300000:
            return 'P2'
        elif zhvi < 500000:
            return 'P3'
        elif zhvi < 1000000:
            return 'P4'
        else:
            return 'P5'

    backtest['price_tier'] = backtest['zhvi'].apply(get_price_tier)

    # Add density tier
    def get_density_tier(density):
        if pd.isna(density):
            return None
        if density < 500:
            return 'Rural'
        elif density < 3000:
            return 'Suburban'
        else:
            return 'Urban'

    backtest['density_tier'] = backtest['density'].apply(get_density_tier)

    report_progress(90, "Dataset ready")
    return backtest


def main():
    """Main preparation function."""
    parser = argparse.ArgumentParser(description='Prepare backtest data')
    parser.add_argument('--start-date', type=str, default='2018-01-01',
                        help='Start date for backtest data (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, default='2023-01-01',
                        help='End date for backtest data (YYYY-MM-DD)')
    args = parser.parse_args()

    print("=" * 60)
    print("PropertyIQ ML - Prepare Backtest Data")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Date range: {args.start_date} to {args.end_date}")
    print("=" * 60)

    report_progress(0, "Loading exported data...")

    # Load exported parquet files
    geographies_df = load_parquet('geographies.parquet')
    zillow_df = load_parquet('zillow_historical.parquet')
    census_df = load_parquet('census_latest.parquet')
    economic_df = load_parquet('economic.parquet')

    print(f"  Loaded {len(geographies_df):,} geographies")
    print(f"  Loaded {len(zillow_df):,} Zillow records")
    print(f"  Loaded {len(census_df):,} Census records")
    print(f"  Loaded {len(economic_df):,} Economic records")

    report_progress(10, "Data loaded")

    # Filter to date range
    zillow_df['date'] = pd.to_datetime(zillow_df['date'])
    zillow_df = zillow_df[
        (zillow_df['date'] >= args.start_date) &
        (zillow_df['date'] <= args.end_date)
    ]

    # Calculate returns
    returns_df = calculate_returns(zillow_df)
    print(f"  Calculated returns for {len(returns_df):,} geography-date pairs")

    # Calculate features
    features_df = calculate_features(zillow_df, census_df, economic_df, geographies_df)
    print(f"  Calculated features for {len(features_df):,} geography-date pairs")

    # Create final dataset
    backtest_df = create_backtest_dataset(features_df, returns_df)
    print(f"  Final backtest dataset: {len(backtest_df):,} rows")

    # Save to parquet
    output_dir = get_output_dir()
    output_path = os.path.join(output_dir, 'backtest_data.parquet')
    backtest_df.to_parquet(output_path, index=False)
    size_mb = os.path.getsize(output_path) / (1024 * 1024)

    report_progress(100, "Complete!")

    print("=" * 60)
    print("Backtest Data Summary:")
    print(f"  Output: {output_path} ({size_mb:.1f} MB)")
    print(f"  Rows: {len(backtest_df):,}")
    print(f"  Date range: {backtest_df['date'].min()} to {backtest_df['date'].max()}")
    print(f"  Unique geographies: {backtest_df['geography_id'].nunique():,}")
    print(f"  Features: {len([c for c in backtest_df.columns if c not in ['geography_id', 'date', 'return_1y', 'return_3y', 'return_5y']])}")
    print("=" * 60)


if __name__ == '__main__':
    main()
