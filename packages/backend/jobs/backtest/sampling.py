"""
Stratified Sampling for PropertyIQ Backtesting

Implements stratified sampling to reduce computation from 67,000+ geographies
to ~4,000 while maintaining statistical validity.

Sampling Strategy:
- National: 1 (100% - full coverage)
- State: 51 (100% - full coverage)
- Metro: ~400 (100% - full coverage)
- County: 500 (16% - stratified by state + population tier)
- City: 1,000 (3% - stratified by state + metro + size)
- ZIP: 2,000 (6% - stratified by metro + price tier)
"""

import os
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
import pandas as pd
import numpy as np
from psycopg2 import pool
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection pool
_connection_pool: Optional[pool.ThreadedConnectionPool] = None


def get_connection_pool() -> pool.ThreadedConnectionPool:
    """Get or create database connection pool."""
    global _connection_pool
    if _connection_pool is None:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is required")
        _connection_pool = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=database_url
        )
    return _connection_pool


def execute_query(query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
    """Execute a query and return results as list of dicts."""
    conn_pool = get_connection_pool()
    conn = conn_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            columns = [desc[0] for desc in cur.description]
            results = [dict(zip(columns, row)) for row in cur.fetchall()]
        return results
    finally:
        conn_pool.putconn(conn)


@dataclass
class SamplingConfig:
    """Configuration for stratified sampling."""
    geography_type: str
    sample_size: int
    stratify_by: List[str] = field(default_factory=list)
    min_per_stratum: int = 1
    random_seed: int = 42

    # Default sample sizes by geography type
    DEFAULT_SIZES = {
        'national': 1,
        'state': 51,
        'metro': 400,
        'county': 500,
        'city': 1000,
        'zip': 2000,
    }

    # Stratification fields by geography type
    DEFAULT_STRATA = {
        'national': [],
        'state': [],
        'metro': [],
        'county': ['state_fips', 'population_tier'],
        'city': ['state_fips', 'metro_cbsa', 'size_tier'],
        'zip': ['metro_cbsa', 'price_tier'],
    }

    @classmethod
    def default_for_geography(cls, geography_type: str, random_seed: int = 42) -> 'SamplingConfig':
        """Create default sampling config for a geography type."""
        geo_type = geography_type.lower()
        return cls(
            geography_type=geo_type,
            sample_size=cls.DEFAULT_SIZES.get(geo_type, 500),
            stratify_by=cls.DEFAULT_STRATA.get(geo_type, []),
            random_seed=random_seed,
        )


@dataclass
class SampleResult:
    """Result of stratified sampling."""
    geography_type: str
    sample_size: int
    total_population: int
    geography_ids: List[str]
    sampling_method: str  # 'full' or 'stratified'
    strata_config: Dict[str, Any]
    strata_distribution: Dict[str, int]  # Distribution across strata


# Population tier boundaries (using population quartiles)
POPULATION_TIERS = {
    'very_small': (0, 10000),
    'small': (10000, 50000),
    'medium': (50000, 200000),
    'large': (200000, 1000000),
    'very_large': (1000000, float('inf')),
}

# Price tier boundaries (using median home value quartiles)
PRICE_TIERS = {
    'affordable': (0, 150000),
    'moderate': (150000, 300000),
    'above_average': (300000, 500000),
    'expensive': (500000, 800000),
    'very_expensive': (800000, float('inf')),
}

# Size tier for cities (by population)
SIZE_TIERS = {
    'small': (0, 25000),
    'medium': (25000, 100000),
    'large': (100000, 500000),
    'major': (500000, float('inf')),
}


def get_tier(value: Optional[float], tier_boundaries: Dict[str, Tuple[float, float]]) -> str:
    """Assign a tier based on value and tier boundaries."""
    if value is None or pd.isna(value):
        return 'unknown'
    for tier_name, (low, high) in tier_boundaries.items():
        if low <= value < high:
            return tier_name
    return 'unknown'


def get_all_geography_ids(geography_type: str) -> List[str]:
    """
    Get all geography IDs for a given type.
    Used for full coverage levels (national, state, metro).
    """
    geo_type = geography_type.lower()

    query_map = {
        'national': "SELECT 'US' as id",
        'state': "SELECT DISTINCT state_fips as id FROM geography_state WHERE state_fips IS NOT NULL",
        'metro': "SELECT DISTINCT cbsa_code as id FROM zillow_metro WHERE cbsa_code IS NOT NULL",
        'county': "SELECT DISTINCT county_fips as id FROM geography_county WHERE county_fips IS NOT NULL",
        'city': "SELECT DISTINCT city_id as id FROM zillow_city WHERE city_id IS NOT NULL",
        'zip': "SELECT DISTINCT zip_code as id FROM zillow_zip WHERE zip_code IS NOT NULL",
    }

    query = query_map.get(geo_type)
    if not query:
        raise ValueError(f"Unknown geography type: {geography_type}")

    results = execute_query(query)
    return [str(r['id']) for r in results if r['id']]


def get_geography_attributes(geography_type: str) -> pd.DataFrame:
    """
    Fetch geography attributes for stratification.
    Returns DataFrame with id and relevant attributes for stratification.
    """
    geo_type = geography_type.lower()

    if geo_type == 'county':
        query = """
            SELECT
                gc.county_fips as id,
                gc.state_fips,
                COALESCE(tc.population, 0) as population
            FROM geography_county gc
            LEFT JOIN tiger_county tc ON gc.county_fips = tc.county_fips
            WHERE gc.county_fips IS NOT NULL
        """
    elif geo_type == 'city':
        query = """
            SELECT
                zc.city_id as id,
                zc.state_code as state_fips,
                zm.cbsa_code as metro_cbsa,
                COALESCE(
                    (SELECT population FROM tiger_county tc
                     JOIN geography_crosswalk gx ON tc.county_fips = gx.county_fips
                     WHERE gx.city_name = zc.city LIMIT 1),
                    50000
                ) as population
            FROM zillow_city zc
            LEFT JOIN zillow_metro_crosswalk zm ON zc.metro = zm.region_name
            WHERE zc.city_id IS NOT NULL
        """
    elif geo_type == 'zip':
        query = """
            SELECT
                zz.zip_code as id,
                zm.cbsa_code as metro_cbsa,
                COALESCE(zz.zhvi, 300000) as median_home_value
            FROM zillow_zip zz
            LEFT JOIN zillow_metro_crosswalk zm ON zz.metro = zm.region_name
            WHERE zz.zip_code IS NOT NULL
        """
    else:
        # For full coverage types, just return IDs
        ids = get_all_geography_ids(geo_type)
        return pd.DataFrame({'id': ids})

    results = execute_query(query)
    return pd.DataFrame(results)


def add_tier_columns(df: pd.DataFrame, geography_type: str) -> pd.DataFrame:
    """Add tier columns based on geography type."""
    df = df.copy()

    if geography_type == 'county':
        df['population_tier'] = df['population'].apply(
            lambda x: get_tier(x, POPULATION_TIERS)
        )
    elif geography_type == 'city':
        df['size_tier'] = df['population'].apply(
            lambda x: get_tier(x, SIZE_TIERS)
        )
    elif geography_type == 'zip':
        df['price_tier'] = df['median_home_value'].apply(
            lambda x: get_tier(x, PRICE_TIERS)
        )

    return df


def stratified_sample(
    df: pd.DataFrame,
    config: SamplingConfig
) -> Tuple[pd.DataFrame, Dict[str, int]]:
    """
    Perform stratified sampling on a DataFrame.

    Returns:
        Tuple of (sampled DataFrame, strata distribution dict)
    """
    if df.empty:
        return df, {}

    np.random.seed(config.random_seed)

    # If no stratification needed or sample size >= population
    if not config.stratify_by or config.sample_size >= len(df):
        return df, {'full': len(df)}

    # Create strata column
    strata_cols = [col for col in config.stratify_by if col in df.columns]
    if not strata_cols:
        # Random sample if stratification columns not available
        sampled = df.sample(n=min(config.sample_size, len(df)), random_state=config.random_seed)
        return sampled, {'random': len(sampled)}

    # Combine stratification columns into a single stratum key
    df['_stratum'] = df[strata_cols].astype(str).agg('_'.join, axis=1)

    # Calculate proportional allocation
    strata_counts = df['_stratum'].value_counts()
    total = len(df)

    # Allocate samples proportionally, with minimum per stratum
    allocation = {}
    remaining = config.sample_size

    for stratum, count in strata_counts.items():
        # Proportional allocation
        prop_allocation = int(round((count / total) * config.sample_size))
        # Ensure minimum and maximum bounds
        allocation[stratum] = max(config.min_per_stratum, min(prop_allocation, count))
        remaining -= allocation[stratum]

    # Adjust for any rounding issues
    while remaining > 0:
        for stratum in strata_counts.index:
            if remaining <= 0:
                break
            current = allocation[stratum]
            max_possible = strata_counts[stratum]
            if current < max_possible:
                allocation[stratum] += 1
                remaining -= 1

    while remaining < 0:
        for stratum in reversed(strata_counts.index.tolist()):
            if remaining >= 0:
                break
            if allocation[stratum] > config.min_per_stratum:
                allocation[stratum] -= 1
                remaining += 1

    # Sample from each stratum
    sampled_dfs = []
    strata_distribution = {}

    for stratum, n_samples in allocation.items():
        stratum_df = df[df['_stratum'] == stratum]
        if len(stratum_df) <= n_samples:
            sampled_dfs.append(stratum_df)
        else:
            sampled_dfs.append(stratum_df.sample(n=n_samples, random_state=config.random_seed))
        strata_distribution[stratum] = n_samples

    # Combine and clean up
    result = pd.concat(sampled_dfs, ignore_index=True)
    result = result.drop(columns=['_stratum'], errors='ignore')

    return result, strata_distribution


def create_backtest_sample(
    geography_type: str,
    sample_size: Optional[int] = None,
    random_seed: int = 42,
) -> SampleResult:
    """
    Create a stratified sample for backtesting.

    Main entry point for sampling. Automatically determines the appropriate
    sampling strategy based on geography type.

    Args:
        geography_type: Type of geography (national, state, metro, county, city, zip)
        sample_size: Optional override for sample size
        random_seed: Random seed for reproducibility

    Returns:
        SampleResult with sampled geography IDs and metadata
    """
    geo_type = geography_type.lower()

    # Create config
    config = SamplingConfig.default_for_geography(geo_type, random_seed)
    if sample_size is not None:
        config.sample_size = sample_size

    logger.info(f"Creating backtest sample for {geo_type} (target: {config.sample_size})")

    # For full coverage types, return all IDs
    if geo_type in ('national', 'state', 'metro'):
        all_ids = get_all_geography_ids(geo_type)
        logger.info(f"Full coverage for {geo_type}: {len(all_ids)} geographies")
        return SampleResult(
            geography_type=geo_type,
            sample_size=len(all_ids),
            total_population=len(all_ids),
            geography_ids=all_ids,
            sampling_method='full',
            strata_config={},
            strata_distribution={'full': len(all_ids)},
        )

    # For sampled types, get attributes and perform stratified sampling
    df = get_geography_attributes(geo_type)
    total_population = len(df)
    logger.info(f"Total {geo_type} population: {total_population}")

    # Add tier columns
    df = add_tier_columns(df, geo_type)

    # Perform stratified sampling
    sampled_df, strata_distribution = stratified_sample(df, config)
    sampled_ids = sampled_df['id'].astype(str).tolist()

    logger.info(f"Sampled {len(sampled_ids)} {geo_type} geographies")
    logger.info(f"Strata distribution: {strata_distribution}")

    return SampleResult(
        geography_type=geo_type,
        sample_size=len(sampled_ids),
        total_population=total_population,
        geography_ids=sampled_ids,
        sampling_method='stratified',
        strata_config={
            'stratify_by': config.stratify_by,
            'min_per_stratum': config.min_per_stratum,
            'random_seed': config.random_seed,
        },
        strata_distribution=strata_distribution,
    )


def create_full_backtest_samples(
    county_sample: int = 500,
    city_sample: int = 1000,
    zip_sample: int = 2000,
    random_seed: int = 42,
) -> Dict[str, SampleResult]:
    """
    Create samples for all geography types.

    Args:
        county_sample: Sample size for counties
        city_sample: Sample size for cities
        zip_sample: Sample size for ZIPs
        random_seed: Random seed for reproducibility

    Returns:
        Dict mapping geography type to SampleResult
    """
    samples = {}

    # Full coverage types
    for geo_type in ['national', 'state', 'metro']:
        samples[geo_type] = create_backtest_sample(geo_type, random_seed=random_seed)

    # Sampled types
    samples['county'] = create_backtest_sample('county', county_sample, random_seed)
    samples['city'] = create_backtest_sample('city', city_sample, random_seed)
    samples['zip'] = create_backtest_sample('zip', zip_sample, random_seed)

    # Log summary
    total_geographies = sum(s.sample_size for s in samples.values())
    logger.info(f"Total geographies in sample: {total_geographies}")

    return samples


if __name__ == '__main__':
    """Test sampling with command-line execution."""
    import argparse

    parser = argparse.ArgumentParser(description='Create backtest samples')
    parser.add_argument('--geography-type', '-g', type=str, help='Geography type to sample')
    parser.add_argument('--sample-size', '-s', type=int, help='Sample size')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    parser.add_argument('--all', '-a', action='store_true', help='Create samples for all geography types')

    args = parser.parse_args()

    if args.all:
        samples = create_full_backtest_samples(random_seed=args.seed)
        for geo_type, sample in samples.items():
            print(f"\n{geo_type.upper()}:")
            print(f"  Sample size: {sample.sample_size} / {sample.total_population}")
            print(f"  Method: {sample.sampling_method}")
            if sample.strata_distribution:
                print(f"  Strata: {len(sample.strata_distribution)} groups")
    elif args.geography_type:
        sample = create_backtest_sample(
            args.geography_type,
            args.sample_size,
            args.seed
        )
        print(f"\n{sample.geography_type.upper()} Sample:")
        print(f"  Sample size: {sample.sample_size} / {sample.total_population}")
        print(f"  Method: {sample.sampling_method}")
        print(f"  Strata config: {sample.strata_config}")
        print(f"  Strata distribution: {sample.strata_distribution}")
        print(f"  First 10 IDs: {sample.geography_ids[:10]}")
    else:
        parser.print_help()
