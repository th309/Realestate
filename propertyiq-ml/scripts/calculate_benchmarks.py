"""
Calculate Benchmarks

Computes benchmarks for measuring EXCESS returns (not just raw returns):
- National: Average across all US geographies
- Regional: Average within same Metro/State
- Peer Group: Average within similar geographies (240 groups)

Peer Group Dimensions:
- Price tier (5): P1 (<$150K), P2 ($150-300K), P3 ($300-500K), P4 ($500K-1M), P5 (>$1M)
- Density (3): Rural (<500/sq mi), Suburban (500-3000), Urban (>3000)
- Region (4): Northeast, Midwest, South, West
- Market Temp (4): Cold, Cool, Warm, Hot (based on days on market)

Outputs:
- backtest_with_benchmarks.parquet
- benchmarks_national.parquet
- benchmarks_regional.parquet
- benchmarks_peer.parquet

Usage:
    python calculate_benchmarks.py
    python calculate_benchmarks.py --horizon 1y  # Only 1-year returns
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


# Peer group definitions
PRICE_TIERS = ['P1', 'P2', 'P3', 'P4', 'P5']
DENSITY_TIERS = ['Rural', 'Suburban', 'Urban']
REGIONS = ['Northeast', 'Midwest', 'South', 'West']


def load_backtest_data() -> pd.DataFrame:
    """Load the prepared backtest data."""
    filepath = os.path.join(get_output_dir(), 'backtest_data.parquet')
    if not os.path.exists(filepath):
        raise FileNotFoundError(
            f"Backtest data not found: {filepath}. Run prepare_backtest_data.py first."
        )
    return pd.read_parquet(filepath)


def calculate_national_benchmarks(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate national average returns by date.

    Returns DataFrame with columns: date, national_return_1y, national_return_3y, national_return_5y
    """
    report_progress(10, "Calculating national benchmarks...")

    benchmarks = df.groupby('date').agg({
        'return_1y': 'mean',
        'return_3y': 'mean',
        'return_5y': 'mean',
    }).reset_index()

    benchmarks.columns = ['date', 'national_return_1y', 'national_return_3y', 'national_return_5y']

    print(f"  National benchmarks: {len(benchmarks)} dates")
    return benchmarks


def calculate_regional_benchmarks(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate regional average returns by metro/state and date.

    Returns DataFrame with regional benchmark columns.
    """
    report_progress(25, "Calculating regional benchmarks...")

    # By metro
    metro_benchmarks = df.groupby(['date', 'metro_id']).agg({
        'return_1y': 'mean',
        'return_3y': 'mean',
        'return_5y': 'mean',
    }).reset_index()
    metro_benchmarks.columns = ['date', 'metro_id', 'metro_return_1y', 'metro_return_3y', 'metro_return_5y']

    # By state
    state_benchmarks = df.groupby(['date', 'state_code']).agg({
        'return_1y': 'mean',
        'return_3y': 'mean',
        'return_5y': 'mean',
    }).reset_index()
    state_benchmarks.columns = ['date', 'state_code', 'state_return_1y', 'state_return_3y', 'state_return_5y']

    print(f"  Metro benchmarks: {len(metro_benchmarks)} metro-date pairs")
    print(f"  State benchmarks: {len(state_benchmarks)} state-date pairs")

    return metro_benchmarks, state_benchmarks


def calculate_peer_benchmarks(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate peer group average returns.

    Peer groups are defined by: price_tier x density_tier x region
    Total: 5 x 3 x 4 = 60 peer groups (times date = many more rows)

    Returns DataFrame with peer benchmark columns.
    """
    report_progress(40, "Calculating peer group benchmarks...")

    # Ensure peer group columns exist
    if 'price_tier' not in df.columns or 'density_tier' not in df.columns:
        raise ValueError("Backtest data missing price_tier or density_tier. Re-run prepare_backtest_data.py")

    # Calculate peer group benchmarks
    peer_benchmarks = df.groupby(['date', 'price_tier', 'density_tier', 'region']).agg({
        'return_1y': 'mean',
        'return_3y': 'mean',
        'return_5y': 'mean',
        'geography_id': 'count',  # Count for confidence
    }).reset_index()

    peer_benchmarks.columns = [
        'date', 'price_tier', 'density_tier', 'region',
        'peer_return_1y', 'peer_return_3y', 'peer_return_5y', 'peer_count'
    ]

    # Count unique peer groups
    unique_groups = peer_benchmarks.groupby(['price_tier', 'density_tier', 'region']).size()
    print(f"  Peer groups: {len(unique_groups)} unique combinations")
    print(f"  Peer benchmarks: {len(peer_benchmarks)} peer-date pairs")

    return peer_benchmarks


def add_benchmarks_to_backtest(
    df: pd.DataFrame,
    national_benchmarks: pd.DataFrame,
    metro_benchmarks: pd.DataFrame,
    state_benchmarks: pd.DataFrame,
    peer_benchmarks: pd.DataFrame
) -> pd.DataFrame:
    """
    Merge benchmark columns into the backtest data and calculate excess returns.
    """
    report_progress(60, "Merging benchmarks with backtest data...")

    # Start with original data
    result = df.copy()

    # Add national benchmarks
    result = result.merge(national_benchmarks, on='date', how='left')

    # Add metro benchmarks
    result = result.merge(metro_benchmarks, on=['date', 'metro_id'], how='left')

    # Add state benchmarks
    result = result.merge(state_benchmarks, on=['date', 'state_code'], how='left')

    # Add peer benchmarks
    result = result.merge(
        peer_benchmarks,
        on=['date', 'price_tier', 'density_tier', 'region'],
        how='left'
    )

    report_progress(75, "Calculating excess returns...")

    # Calculate excess returns vs national
    result['excess_vs_national_1y'] = result['return_1y'] - result['national_return_1y']
    result['excess_vs_national_3y'] = result['return_3y'] - result['national_return_3y']
    result['excess_vs_national_5y'] = result['return_5y'] - result['national_return_5y']

    # Calculate excess returns vs regional (prefer metro, fallback to state)
    result['regional_return_1y'] = result['metro_return_1y'].fillna(result['state_return_1y'])
    result['regional_return_3y'] = result['metro_return_3y'].fillna(result['state_return_3y'])
    result['regional_return_5y'] = result['metro_return_5y'].fillna(result['state_return_5y'])

    result['excess_vs_regional_1y'] = result['return_1y'] - result['regional_return_1y']
    result['excess_vs_regional_3y'] = result['return_3y'] - result['regional_return_3y']
    result['excess_vs_regional_5y'] = result['return_5y'] - result['regional_return_5y']

    # Calculate excess returns vs peer group
    result['excess_vs_peer_1y'] = result['return_1y'] - result['peer_return_1y']
    result['excess_vs_peer_3y'] = result['return_3y'] - result['peer_return_3y']
    result['excess_vs_peer_5y'] = result['return_5y'] - result['peer_return_5y']

    # Calculate composite excess return (weighted)
    # 20% national, 30% regional, 50% peer
    result['composite_excess_1y'] = (
        0.20 * result['excess_vs_national_1y'].fillna(0) +
        0.30 * result['excess_vs_regional_1y'].fillna(0) +
        0.50 * result['excess_vs_peer_1y'].fillna(0)
    )

    print(f"  Final dataset: {len(result):,} rows with benchmarks")
    return result


def main():
    """Main benchmark calculation."""
    parser = argparse.ArgumentParser(description='Calculate benchmarks for excess returns')
    parser.add_argument('--horizon', type=str, choices=['1y', '3y', '5y', 'all'],
                        default='all', help='Which return horizon to calculate')
    args = parser.parse_args()

    print("=" * 60)
    print("PropertyIQ ML - Calculate Benchmarks")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    report_progress(0, "Loading backtest data...")

    # Load backtest data
    df = load_backtest_data()
    print(f"  Loaded {len(df):,} backtest records")

    # Calculate benchmarks
    national_benchmarks = calculate_national_benchmarks(df)
    metro_benchmarks, state_benchmarks = calculate_regional_benchmarks(df)
    peer_benchmarks = calculate_peer_benchmarks(df)

    # Merge and calculate excess returns
    result = add_benchmarks_to_backtest(
        df, national_benchmarks, metro_benchmarks, state_benchmarks, peer_benchmarks
    )

    report_progress(85, "Saving outputs...")

    # Save outputs
    output_dir = get_output_dir()

    # Main backtest file with benchmarks
    main_path = os.path.join(output_dir, 'backtest_with_benchmarks.parquet')
    result.to_parquet(main_path, index=False)
    print(f"  Saved: {main_path}")

    # National benchmarks
    national_path = os.path.join(output_dir, 'benchmarks_national.parquet')
    national_benchmarks.to_parquet(national_path, index=False)
    print(f"  Saved: {national_path}")

    # Regional benchmarks (combined)
    regional = metro_benchmarks.merge(
        state_benchmarks,
        on='date',
        how='outer'
    )
    regional_path = os.path.join(output_dir, 'benchmarks_regional.parquet')
    regional.to_parquet(regional_path, index=False)
    print(f"  Saved: {regional_path}")

    # Peer benchmarks
    peer_path = os.path.join(output_dir, 'benchmarks_peer.parquet')
    peer_benchmarks.to_parquet(peer_path, index=False)
    print(f"  Saved: {peer_path}")

    report_progress(100, "Complete!")

    print("=" * 60)
    print("Benchmark Summary:")
    print(f"  National avg 1Y return: {national_benchmarks['national_return_1y'].mean():.2f}%")
    print(f"  Peer groups: {peer_benchmarks.groupby(['price_tier', 'density_tier', 'region']).ngroups}")
    print(f"  Excess return range (1Y): {result['composite_excess_1y'].min():.2f}% to {result['composite_excess_1y'].max():.2f}%")
    print("=" * 60)


if __name__ == '__main__':
    main()
