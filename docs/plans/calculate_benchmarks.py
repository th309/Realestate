# scripts/calculate_benchmarks.py
"""
Calculate regional and peer group benchmarks for PropertyIQ backtesting.

Benchmarks allow us to measure EXCESS returns (vs just raw returns).
This answers: "Did high-scoring areas OUTPERFORM their comparison group?"

Three benchmark levels:
1. National: Average across all US geographies
2. Regional: Average within the same Metro/State
3. Peer Group: Average within similar geographies (price tier, density, region, etc.)

Usage: python scripts/calculate_benchmarks.py
"""

import polars as pl
import numpy as np
from datetime import datetime
import os
from tqdm import tqdm

def calculate_all_benchmarks():
    """Main function to calculate all benchmark types."""
    
    print("=" * 70)
    print("BENCHMARK CALCULATION")
    print("=" * 70)
    print("\nBenchmarks let us measure EXCESS returns, not just raw returns.")
    print("A ZIP that went up 10% when its metro went up 15% UNDERPERFORMED by 5%.\n")
    
    # Load data
    print("[1/5] Loading data...")
    df = pl.read_parquet("data/backtest_data.parquet")
    geo = pl.read_parquet("data/geographies.parquet")
    
    print(f"   Loaded {len(df):,} backtest records")
    print(f"   Loaded {len(geo):,} geographies")
    
    # Add geography attributes if not present
    if "metro_cbsa" not in df.columns:
        df = df.join(
            geo.select(["geography_id", "metro_cbsa", "state_fips"]),
            on="geography_id",
            how="left"
        )
    
    # ─────────────────────────────────────────────────────────────
    # Step 1: Assign Peer Groups
    # ─────────────────────────────────────────────────────────────
    print("\n[2/5] Assigning peer groups...")
    df = assign_peer_groups(df)
    
    # ─────────────────────────────────────────────────────────────
    # Step 2: Calculate National Benchmarks
    # ─────────────────────────────────────────────────────────────
    print("\n[3/5] Calculating national benchmarks...")
    national_benchmarks = calculate_national_benchmarks(df)
    
    # ─────────────────────────────────────────────────────────────
    # Step 3: Calculate Regional Benchmarks
    # ─────────────────────────────────────────────────────────────
    print("\n[4/5] Calculating regional benchmarks...")
    regional_benchmarks = calculate_regional_benchmarks(df)
    
    # ─────────────────────────────────────────────────────────────
    # Step 4: Calculate Peer Benchmarks
    # ─────────────────────────────────────────────────────────────
    print("\n[5/5] Calculating peer group benchmarks...")
    peer_benchmarks = calculate_peer_benchmarks(df)
    
    # ─────────────────────────────────────────────────────────────
    # Join all benchmarks back to main dataset
    # ─────────────────────────────────────────────────────────────
    print("\nJoining benchmarks to dataset...")
    
    # Join national
    df = df.join(national_benchmarks, on="score_date", how="left")
    
    # Join regional (by metro)
    df = df.join(
        regional_benchmarks,
        on=["score_date", "metro_cbsa"],
        how="left"
    )
    
    # Join peer
    df = df.join(
        peer_benchmarks,
        on=["score_date", "peer_group_id"],
        how="left"
    )
    
    # ─────────────────────────────────────────────────────────────
    # Calculate excess returns
    # ─────────────────────────────────────────────────────────────
    print("Calculating excess returns...")
    
    df = df.with_columns([
        # Excess vs National
        (pl.col("price_change_1y") - pl.col("national_avg_1y")).alias("excess_vs_national_1y"),
        (pl.col("price_change_3y") - pl.col("national_avg_3y")).alias("excess_vs_national_3y"),
        (pl.col("price_change_5y") - pl.col("national_avg_5y")).alias("excess_vs_national_5y"),
        
        # Excess vs Regional (Metro)
        (pl.col("price_change_1y") - pl.col("regional_avg_1y")).alias("excess_vs_regional_1y"),
        (pl.col("price_change_3y") - pl.col("regional_avg_3y")).alias("excess_vs_regional_3y"),
        (pl.col("price_change_5y") - pl.col("regional_avg_5y")).alias("excess_vs_regional_5y"),
        
        # Excess vs Peer Group
        (pl.col("price_change_1y") - pl.col("peer_median_1y")).alias("excess_vs_peer_1y"),
        (pl.col("price_change_3y") - pl.col("peer_median_3y")).alias("excess_vs_peer_3y"),
        (pl.col("price_change_5y") - pl.col("peer_median_5y")).alias("excess_vs_peer_5y"),
        
        # Composite excess (weighted average of all three)
        (
            pl.col("price_change_1y") - pl.col("national_avg_1y") * 0.2 
            - pl.col("regional_avg_1y") * 0.3 
            - pl.col("peer_median_1y") * 0.5
        ).alias("composite_excess_1y"),
    ])
    
    # ─────────────────────────────────────────────────────────────
    # Save
    # ─────────────────────────────────────────────────────────────
    output_path = "data/backtest_with_benchmarks.parquet"
    df.write_parquet(output_path, compression="zstd")
    
    # Also save benchmark tables separately for reference
    national_benchmarks.write_parquet("data/benchmarks_national.parquet")
    regional_benchmarks.write_parquet("data/benchmarks_regional.parquet")
    peer_benchmarks.write_parquet("data/benchmarks_peer.parquet")
    
    file_size = os.path.getsize(output_path) / (1024 * 1024)
    
    print("\n" + "=" * 70)
    print("BENCHMARK CALCULATION COMPLETE")
    print("=" * 70)
    print(f"\nMain dataset: {output_path} ({file_size:.1f} MB)")
    print(f"Records: {len(df):,}")
    print(f"\nNew columns added:")
    print("  - peer_group_id")
    print("  - national_avg_1y, national_avg_3y, national_avg_5y")
    print("  - regional_avg_1y, regional_avg_3y, regional_avg_5y")
    print("  - peer_median_1y, peer_median_3y, peer_median_5y")
    print("  - excess_vs_national_1y/3y/5y")
    print("  - excess_vs_regional_1y/3y/5y")
    print("  - excess_vs_peer_1y/3y/5y")
    print("  - composite_excess_1y")
    
    # Show summary stats
    print("\n" + "-" * 70)
    print("BENCHMARK SUMMARY (1-Year Horizon)")
    print("-" * 70)
    
    summary = df.select([
        pl.col("national_avg_1y").mean().alias("Avg National Return"),
        pl.col("regional_avg_1y").mean().alias("Avg Regional Return"),
        pl.col("peer_median_1y").mean().alias("Avg Peer Return"),
        pl.col("excess_vs_national_1y").std().alias("Std Dev vs National"),
        pl.col("excess_vs_peer_1y").std().alias("Std Dev vs Peer"),
    ]).to_pandas().T
    
    print(summary.to_string())
    
    return df


def assign_peer_groups(df: pl.DataFrame) -> pl.DataFrame:
    """
    Assign each geography to a peer group based on:
    - Price tier (5 levels)
    - Population density (3 levels: rural, suburban, urban)
    - Region (4 levels: Northeast, Midwest, South, West)
    - Metro size (4 levels)
    
    Total: 5 × 3 × 4 × 4 = 240 peer groups
    """
    
    # Price tier
    df = df.with_columns([
        pl.when(pl.col("zhvi") < 150000).then(pl.lit("P1"))
        .when(pl.col("zhvi") < 300000).then(pl.lit("P2"))
        .when(pl.col("zhvi") < 500000).then(pl.lit("P3"))
        .when(pl.col("zhvi") < 1000000).then(pl.lit("P4"))
        .otherwise(pl.lit("P5"))
        .alias("price_tier")
    ])
    
    # Density tier
    df = df.with_columns([
        pl.when(pl.col("population_density") < 500).then(pl.lit("R"))  # Rural
        .when(pl.col("population_density") < 3000).then(pl.lit("S"))   # Suburban
        .otherwise(pl.lit("U"))  # Urban
        .alias("density_tier")
    ])
    
    # Region (based on state FIPS)
    northeast = ['09', '23', '25', '33', '44', '50', '34', '36', '42']
    midwest = ['17', '18', '19', '20', '26', '27', '29', '31', '38', '39', '46', '55']
    south = ['01', '05', '10', '11', '12', '13', '21', '22', '24', '28', '37', '40', '45', '47', '48', '51', '54']
    # West is everything else
    
    df = df.with_columns([
        pl.when(pl.col("state_fips").is_in(northeast)).then(pl.lit("NE"))
        .when(pl.col("state_fips").is_in(midwest)).then(pl.lit("MW"))
        .when(pl.col("state_fips").is_in(south)).then(pl.lit("SO"))
        .otherwise(pl.lit("WE"))
        .alias("region")
    ])
    
    # Metro size tier (would need metro population - using proxy)
    # For now, use a simplified version
    df = df.with_columns([
        pl.lit("M").alias("metro_size_tier")  # Placeholder - would calculate from metro population
    ])
    
    # Combine into peer group ID
    df = df.with_columns([
        pl.concat_str([
            pl.col("price_tier"),
            pl.lit("-"),
            pl.col("density_tier"),
            pl.lit("-"),
            pl.col("region"),
        ]).alias("peer_group_id")
    ])
    
    # Count peer groups
    peer_counts = df.group_by("peer_group_id").count().sort("count", descending=True)
    print(f"   Created {len(peer_counts)} peer groups")
    print(f"   Largest peer group: {peer_counts[0, 'peer_group_id']} ({peer_counts[0, 'count']:,} records)")
    print(f"   Smallest peer group: {peer_counts[-1, 'peer_group_id']} ({peer_counts[-1, 'count']:,} records)")
    
    return df


def calculate_national_benchmarks(df: pl.DataFrame) -> pl.DataFrame:
    """Calculate national average returns for each score date."""
    
    benchmarks = df.group_by("score_date").agg([
        # Mean returns
        pl.col("price_change_1y").mean().alias("national_avg_1y"),
        pl.col("price_change_3y").mean().alias("national_avg_3y"),
        pl.col("price_change_5y").mean().alias("national_avg_5y"),
        
        # Median returns
        pl.col("price_change_1y").median().alias("national_median_1y"),
        pl.col("price_change_3y").median().alias("national_median_3y"),
        pl.col("price_change_5y").median().alias("national_median_5y"),
        
        # Standard deviation (for context)
        pl.col("price_change_1y").std().alias("national_std_1y"),
        
        # Count
        pl.count().alias("national_n"),
    ])
    
    print(f"   Calculated benchmarks for {len(benchmarks)} score dates")
    
    # Show sample
    sample = benchmarks.filter(pl.col("score_date") == "2020-01-01")
    if len(sample) > 0:
        print(f"   Example (2020-01-01): Avg 1Y return = {sample[0, 'national_avg_1y']:.2%}")
    
    return benchmarks


def calculate_regional_benchmarks(df: pl.DataFrame) -> pl.DataFrame:
    """Calculate regional (metro) average returns for each score date."""
    
    benchmarks = df.filter(
        pl.col("metro_cbsa").is_not_null()
    ).group_by(["score_date", "metro_cbsa"]).agg([
        # Mean returns
        pl.col("price_change_1y").mean().alias("regional_avg_1y"),
        pl.col("price_change_3y").mean().alias("regional_avg_3y"),
        pl.col("price_change_5y").mean().alias("regional_avg_5y"),
        
        # Median returns
        pl.col("price_change_1y").median().alias("regional_median_1y"),
        
        # Count
        pl.count().alias("regional_n"),
    ])
    
    # Filter to metros with enough data
    benchmarks = benchmarks.filter(pl.col("regional_n") >= 10)
    
    unique_metros = benchmarks.select("metro_cbsa").unique()
    print(f"   Calculated benchmarks for {len(unique_metros)} metros")
    
    return benchmarks


def calculate_peer_benchmarks(df: pl.DataFrame) -> pl.DataFrame:
    """Calculate peer group median returns for each score date."""
    
    benchmarks = df.filter(
        pl.col("peer_group_id").is_not_null()
    ).group_by(["score_date", "peer_group_id"]).agg([
        # Median returns (more robust than mean for peer comparison)
        pl.col("price_change_1y").median().alias("peer_median_1y"),
        pl.col("price_change_3y").median().alias("peer_median_3y"),
        pl.col("price_change_5y").median().alias("peer_median_5y"),
        
        # Percentiles for context
        pl.col("price_change_1y").quantile(0.25).alias("peer_p25_1y"),
        pl.col("price_change_1y").quantile(0.75).alias("peer_p75_1y"),
        
        # Count
        pl.count().alias("peer_n"),
    ])
    
    # Filter to peer groups with enough data
    benchmarks = benchmarks.filter(pl.col("peer_n") >= 20)
    
    unique_peers = benchmarks.select("peer_group_id").unique()
    print(f"   Calculated benchmarks for {len(unique_peers)} peer groups")
    
    return benchmarks


if __name__ == "__main__":
    calculate_all_benchmarks()
