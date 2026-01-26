"""
Data Cache Service - Parquet-based caching for historical data

Provides incremental data loading:
1. Initial load: Fetch all historical data and cache to Parquet
2. Incremental updates: Only fetch new records since last cache
3. Fast reads: Load from local Parquet files instead of database
4. Geography name enrichment: Joins scores with crosswalk for human-readable names
"""

import logging
import os
import json
from datetime import datetime, date
from pathlib import Path
from typing import Optional, Dict, Any

import pandas as pd
from supabase import create_client
from supabase.client import Client

from app.config import get_settings

logger = logging.getLogger(__name__)


# ============================================================================
# Geography Crosswalk Helpers - Resolve IDs to human-readable names
# ============================================================================

def _load_metro_crosswalk(supabase: Client) -> pd.DataFrame:
    """Load metro crosswalk from Supabase for ID->name resolution."""
    try:
        all_data = []
        offset = 0
        batch_size = 1000
        
        while True:
            response = (
                supabase.table('zillow_metro_crosswalk')
                .select('cbsa_code, cbsa_title')
                .not_('cbsa_code', 'is', 'null')
                .range(offset, offset + batch_size - 1)
                .execute()
            )
            if not response.data:
                break
            all_data.extend(response.data)
            if len(response.data) < batch_size:
                break
            offset += batch_size
        
        if all_data:
            df = pd.DataFrame(all_data)
            df = df.drop_duplicates(subset=['cbsa_code'])
            logger.info(f"Loaded {len(df)} metro crosswalk entries")
            return df
    except Exception as e:
        logger.warning(f"Failed to load metro crosswalk: {e}")
    return pd.DataFrame()


def _load_geography_crosswalk(supabase: Client) -> pd.DataFrame:
    """Load geography crosswalk for state/county/zip name resolution."""
    try:
        all_data = []
        offset = 0
        batch_size = 1000
        
        while True:
            response = (
                supabase.table('geography_crosswalk')
                .select('state_abbrev, state_name, county_fips, county_name, zip_code, zip_default_city')
                .range(offset, offset + batch_size - 1)
                .execute()
            )
            if not response.data:
                break
            all_data.extend(response.data)
            if len(response.data) < batch_size:
                break
            offset += batch_size
        
        if all_data:
            df = pd.DataFrame(all_data)
            logger.info(f"Loaded {len(df)} geography crosswalk entries")
            return df
    except Exception as e:
        logger.warning(f"Failed to load geography crosswalk: {e}")
    return pd.DataFrame()


class DataCache:
    """
    Parquet-based cache for PropertyIQ historical data.
    
    Supports incremental updates to avoid re-fetching entire dataset.
    Includes geography name enrichment from crosswalk tables.
    """

    # Columns that exist on propertyiq_scores_history (no geography_name/parent_geography_id)
    _SCORES_HISTORY_COLUMNS = frozenset({
        'id', 'geography_id', 'geography_type', 'period_date',
        'investoredge_score', 'homeready_score', 'market_health_score',
        'actual_appreciation_12m', 'actual_appreciation_36m', 'actual_appreciation_60m',
    })
    
    # Class-level progress tracking for export operations
    _export_progress: Dict[str, Any] = {}
    
    # Class-level crosswalk caches (loaded once, used for all enrichment)
    _metro_crosswalk: Optional[pd.DataFrame] = None
    _geography_crosswalk: Optional[pd.DataFrame] = None
    _crosswalk_loaded: bool = False
    
    def __init__(self, cache_dir: str = None):
        """Initialize cache with specified directory."""
        self.settings = get_settings()
        self._supabase: Optional[Client] = None
        
        # Build list of directories to try
        import tempfile
        dirs_to_try = []
        
        if cache_dir:
            dirs_to_try.append(Path(cache_dir))
        
        env_cache = os.environ.get('CACHE_DIR')
        if env_cache:
            dirs_to_try.append(Path(env_cache))
        
        # Fallbacks - prefer temp directory
        dirs_to_try.append(Path(tempfile.gettempdir()) / 'propertyiq-cache')
        dirs_to_try.append(Path('/tmp/propertyiq-cache'))
        dirs_to_try.append(Path('.') / 'cache')
        
        # Try each directory until we find one that's writable
        self.cache_dir = None
        for dir_path in dirs_to_try:
            try:
                dir_path.mkdir(parents=True, exist_ok=True)
                # Test actual write access with a file
                test_file = dir_path / '.write_test'
                test_file.write_text('test')
                test_file.unlink()
                self.cache_dir = dir_path
                logger.info(f"DataCache initialized at {self.cache_dir} (writable)")
                break
            except (PermissionError, OSError) as e:
                logger.warning(f"Cannot use cache dir {dir_path}: {e}")
                continue
        
        if self.cache_dir is None:
            raise RuntimeError(f"No writable cache directory found. Tried: {dirs_to_try}")
        
        self.metadata_file = self.cache_dir / 'cache_metadata.json'
        self._metadata = self._load_metadata()

    @property
    def supabase(self) -> Client:
        """Lazy-load Supabase client."""
        if self._supabase is None:
            if not self.settings.supabase_url or not self.settings.supabase_service_key:
                raise ValueError("Supabase credentials not configured")
            self._supabase = create_client(
                self.settings.supabase_url,
                self.settings.supabase_service_key
            )
        return self._supabase

    def _load_metadata(self) -> Dict[str, Any]:
        """Load cache metadata from disk."""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load metadata: {e}")
        return {
            'caches': {},
            'created_at': datetime.utcnow().isoformat(),
        }

    def _ensure_crosswalks_loaded(self) -> None:
        """Load crosswalk data if not already loaded (lazy initialization)."""
        if DataCache._crosswalk_loaded:
            return
        
        try:
            logger.info("Loading geography crosswalks for name resolution...")
            DataCache._metro_crosswalk = _load_metro_crosswalk(self.supabase)
            DataCache._geography_crosswalk = _load_geography_crosswalk(self.supabase)
            DataCache._crosswalk_loaded = True
            logger.info(f"Crosswalks loaded: {len(DataCache._metro_crosswalk or [])} metros, "
                       f"{len(DataCache._geography_crosswalk or [])} geographies")
        except Exception as e:
            logger.warning(f"Failed to load crosswalks (name resolution may be unavailable): {e}")
            DataCache._crosswalk_loaded = True  # Don't retry on failure

    def _enrich_with_geography_names(self, df: pd.DataFrame, geo_type: str) -> pd.DataFrame:
        """
        Enrich DataFrame with geography_name and parent_geography_id columns.
        
        Uses crosswalk tables to resolve geography IDs to human-readable names.
        """
        if df is None or len(df) == 0:
            return df
        
        if 'geography_id' not in df.columns:
            return df
        
        # Ensure crosswalks are loaded
        self._ensure_crosswalks_loaded()
        
        # Make a copy to avoid modifying cached data
        df = df.copy()
        
        # Initialize columns if not present
        if 'geography_name' not in df.columns:
            df['geography_name'] = None
        if 'parent_geography_id' not in df.columns:
            df['parent_geography_id'] = None
        
        if geo_type == 'metro':
            # Match by CBSA code
            if DataCache._metro_crosswalk is not None and len(DataCache._metro_crosswalk) > 0:
                crosswalk = DataCache._metro_crosswalk.copy()
                crosswalk = crosswalk.rename(columns={
                    'cbsa_code': 'geography_id',
                    'cbsa_title': 'geography_name_lookup'
                })
                # Merge to add names
                df = df.merge(
                    crosswalk[['geography_id', 'geography_name_lookup']],
                    on='geography_id',
                    how='left'
                )
                # Fill in geography_name from lookup
                df['geography_name'] = df['geography_name_lookup'].combine_first(df['geography_name'])
                df = df.drop(columns=['geography_name_lookup'], errors='ignore')
                
                # Extract state from CBSA title (e.g., "Austin-Round Rock, TX" -> "TX")
                def extract_state(name):
                    if pd.isna(name):
                        return None
                    import re
                    match = re.search(r',\s*([A-Z]{2})(?:-[A-Z]{2})*$', str(name))
                    return match.group(1) if match else None
                
                df['parent_geography_id'] = df['geography_name'].apply(extract_state)
        
        elif geo_type == 'state':
            # States: geography_id is state abbreviation
            if DataCache._geography_crosswalk is not None and len(DataCache._geography_crosswalk) > 0:
                # Get unique state mappings
                state_map = (
                    DataCache._geography_crosswalk[['state_abbrev', 'state_name']]
                    .drop_duplicates()
                    .rename(columns={'state_abbrev': 'geography_id', 'state_name': 'geography_name_lookup'})
                )
                df = df.merge(state_map, on='geography_id', how='left')
                df['geography_name'] = df['geography_name_lookup'].combine_first(df['geography_name'])
                df = df.drop(columns=['geography_name_lookup'], errors='ignore')
        
        elif geo_type == 'county':
            # Counties: geography_id is FIPS code
            if DataCache._geography_crosswalk is not None and len(DataCache._geography_crosswalk) > 0:
                county_map = (
                    DataCache._geography_crosswalk[['county_fips', 'county_name', 'state_abbrev']]
                    .dropna(subset=['county_fips'])
                    .drop_duplicates(subset=['county_fips'])
                    .rename(columns={
                        'county_fips': 'geography_id',
                        'county_name': 'county_name_lookup',
                        'state_abbrev': 'state_lookup'
                    })
                )
                df = df.merge(county_map, on='geography_id', how='left')
                # Create full county name with state
                df['geography_name'] = df.apply(
                    lambda row: f"{row['county_name_lookup']}, {row['state_lookup']}" 
                    if pd.notna(row.get('county_name_lookup')) and pd.notna(row.get('state_lookup'))
                    else row.get('geography_name'),
                    axis=1
                )
                df['parent_geography_id'] = df['state_lookup'].combine_first(df['parent_geography_id'])
                df = df.drop(columns=['county_name_lookup', 'state_lookup'], errors='ignore')
        
        elif geo_type == 'zip':
            # ZIP codes: geography_id is ZIP code
            if DataCache._geography_crosswalk is not None and len(DataCache._geography_crosswalk) > 0:
                zip_map = (
                    DataCache._geography_crosswalk[['zip_code', 'zip_default_city', 'state_abbrev']]
                    .dropna(subset=['zip_code'])
                    .drop_duplicates(subset=['zip_code'])
                    .rename(columns={
                        'zip_code': 'geography_id',
                        'zip_default_city': 'city_lookup',
                        'state_abbrev': 'state_lookup'
                    })
                )
                df = df.merge(zip_map, on='geography_id', how='left')
                # Create ZIP name with city and state
                df['geography_name'] = df.apply(
                    lambda row: f"{row['city_lookup']}, {row['state_lookup']} {row['geography_id']}"
                    if pd.notna(row.get('city_lookup')) and pd.notna(row.get('state_lookup'))
                    else row.get('geography_name'),
                    axis=1
                )
                df['parent_geography_id'] = df['state_lookup'].combine_first(df['parent_geography_id'])
                df = df.drop(columns=['city_lookup', 'state_lookup'], errors='ignore')
        
        # Final fallback: use geography_id as name if still null
        df['geography_name'] = df['geography_name'].fillna(df['geography_id'])
        
        return df

    def _save_metadata(self):
        """Save cache metadata to disk."""
        try:
            self._metadata['updated_at'] = datetime.utcnow().isoformat()
            with open(self.metadata_file, 'w') as f:
                json.dump(self._metadata, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save metadata: {e}")

    def _get_cache_path(self, geo_type: str) -> Path:
        """Get Parquet file path for geography type."""
        return self.cache_dir / f'scores_history_{geo_type}.parquet'

    def get_cache_status(self) -> Dict[str, Any]:
        """Get status of all caches."""
        status = {
            'cache_dir': str(self.cache_dir),
            'caches': {},
        }
        
        for geo_type in ['state', 'metro', 'county', 'zip']:
            cache_path = self._get_cache_path(geo_type)
            cache_info = self._metadata.get('caches', {}).get(geo_type, {})
            
            status['caches'][geo_type] = {
                'exists': cache_path.exists(),
                'file_size_mb': round(cache_path.stat().st_size / 1024 / 1024, 2) if cache_path.exists() else 0,
                'record_count': cache_info.get('record_count', 0),
                'last_date': cache_info.get('last_date'),
                'last_updated': cache_info.get('last_updated'),
            }
        
        return status

    def is_cached(self, geo_type: str) -> bool:
        """Check if geography type has cached data."""
        cache_path = self._get_cache_path(geo_type)
        return cache_path.exists()

    def get_total_count(self, geo_type: str) -> int:
        """Get total record count for a geography type from database."""
        try:
            logger.info(f"get_total_count: Querying count for {geo_type}...")
            query = self.supabase.table('propertyiq_scores_history').select('id', count='exact')
            query = query.eq('geography_type', geo_type)
            query = query.limit(1)
            response = query.execute()
            count = response.count or 0
            logger.info(f"get_total_count: {geo_type} has {count:,} records")
            return count
        except Exception as e:
            logger.error(f"get_total_count FAILED for {geo_type}: {type(e).__name__}: {e}", exc_info=True)
            return 0

    def validate_connection(self, timeout_seconds: int = 30) -> dict:
        """
        Quick validation that Supabase is accessible and data can be fetched.
        
        Runs early to fail fast if there's a connectivity issue.
        Should complete within 30 seconds.
        
        Returns:
            dict with 'success', 'message', and 'details'
        """
        import time
        start_time = time.time()
        
        logger.info("=" * 60)
        logger.info("VALIDATE_CONNECTION: Starting early validation check...")
        logger.info(f"  Supabase URL: {self.settings.supabase_url[:50]}..." if self.settings.supabase_url else "  Supabase URL: NOT SET")
        logger.info(f"  Service Key: {'SET' if self.settings.supabase_service_key else 'NOT SET'}")
        
        try:
            # Step 1: Test basic connectivity by getting a count
            logger.info("  Step 1: Testing connectivity with count query...")
            test_geo = 'metro'  # Start with metro as it's usually smallest
            
            query = self.supabase.table('propertyiq_scores_history').select('id', count='exact')
            query = query.eq('geography_type', test_geo)
            query = query.limit(1)
            response = query.execute()
            
            elapsed = time.time() - start_time
            logger.info(f"  Step 1 PASSED: Count query returned in {elapsed:.2f}s")
            logger.info(f"    Response count: {response.count}")
            
            if response.count == 0:
                logger.warning(f"  WARNING: {test_geo} has 0 records in database!")
            
            # Step 2: Test actual data fetch with 10 records
            logger.info("  Step 2: Testing data fetch with 10 records...")
            
            query2 = self.supabase.table('propertyiq_scores_history').select(
                'id,geography_id,geography_type,period_date,investoredge_score'
            )
            query2 = query2.eq('geography_type', test_geo)
            query2 = query2.limit(10)
            response2 = query2.execute()
            
            elapsed = time.time() - start_time
            
            if not response2.data:
                logger.error(f"  Step 2 FAILED: No data returned for {test_geo}")
                return {
                    "success": False,
                    "message": f"No data returned for {test_geo}",
                    "details": {
                        "count": response.count,
                        "data_returned": 0,
                        "elapsed_seconds": elapsed,
                    }
                }
            
            logger.info(f"  Step 2 PASSED: Fetched {len(response2.data)} records in {elapsed:.2f}s")
            logger.info(f"    Sample record keys: {list(response2.data[0].keys()) if response2.data else 'N/A'}")
            
            # Step 3: Verify data structure
            logger.info("  Step 3: Verifying data structure...")
            sample = response2.data[0]
            required_fields = ['id', 'geography_id', 'geography_type']
            missing = [f for f in required_fields if f not in sample]
            
            if missing:
                logger.error(f"  Step 3 FAILED: Missing required fields: {missing}")
                return {
                    "success": False,
                    "message": f"Data structure invalid - missing fields: {missing}",
                    "details": {
                        "available_fields": list(sample.keys()),
                        "missing_fields": missing,
                    }
                }
            
            elapsed = time.time() - start_time
            logger.info(f"  Step 3 PASSED: All required fields present")
            logger.info("=" * 60)
            logger.info(f"VALIDATE_CONNECTION: SUCCESS in {elapsed:.2f}s")
            logger.info("=" * 60)
            
            return {
                "success": True,
                "message": "Connection validated successfully",
                "details": {
                    "test_geography": test_geo,
                    "total_count": response.count,
                    "sample_fetched": len(response2.data),
                    "elapsed_seconds": round(elapsed, 2),
                }
            }
            
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error("=" * 60)
            logger.error(f"VALIDATE_CONNECTION: FAILED after {elapsed:.2f}s")
            logger.error(f"  Error type: {type(e).__name__}")
            logger.error(f"  Error message: {str(e)}")
            logger.error("  Full traceback:", exc_info=True)
            logger.error("=" * 60)
            
            return {
                "success": False,
                "message": f"Connection failed: {type(e).__name__}: {str(e)}",
                "details": {
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "elapsed_seconds": round(elapsed, 2),
                }
            }

    def get_export_progress(self) -> Dict[str, Any]:
        """Get current export progress."""
        return DataCache._export_progress.copy()

    def _update_progress(
        self,
        geo_type: str,
        records_fetched: int,
        total_records: int,
        status: str = "running"
    ):
        """Update export progress for a geography type."""
        DataCache._export_progress[geo_type] = {
            "records_fetched": records_fetched,
            "total_records": total_records,
            "percent": round(records_fetched / total_records * 100, 1) if total_records > 0 else 0,
            "status": status,
        }
        
        # Calculate overall progress
        geo_types = ['metro', 'county', 'zip', 'state']
        total_fetched = sum(
            DataCache._export_progress.get(gt, {}).get("records_fetched", 0)
            for gt in geo_types
        )
        total_expected = sum(
            DataCache._export_progress.get(gt, {}).get("total_records", 0)
            for gt in geo_types
        )
        
        DataCache._export_progress["overall"] = {
            "records_fetched": total_fetched,
            "total_records": total_expected,
            "percent": round(total_fetched / total_expected * 100, 1) if total_expected > 0 else 0,
            "status": status,
        }

    def reset_progress(self):
        """Reset export progress tracking."""
        DataCache._export_progress = {}

    def get_last_cached_date(self, geo_type: str) -> Optional[str]:
        """Get the most recent period_date in cache."""
        cache_info = self._metadata.get('caches', {}).get(geo_type, {})
        return cache_info.get('last_date')

    def load_from_cache(self, geo_type: str) -> Optional[pd.DataFrame]:
        """Load data from Parquet cache."""
        cache_path = self._get_cache_path(geo_type)
        
        if not cache_path.exists():
            logger.info(f"No cache found for {geo_type}")
            return None
        
        try:
            df = pd.read_parquet(cache_path)
            logger.info(f"Loaded {len(df)} records from cache for {geo_type}")
            return df
        except Exception as e:
            logger.error(f"Failed to load cache for {geo_type}: {e}")
            return None

    def save_to_cache(self, geo_type: str, df: pd.DataFrame):
        """Save DataFrame to Parquet cache."""
        cache_path = self._get_cache_path(geo_type)
        
        try:
            df.to_parquet(cache_path, index=False, compression='snappy')
            
            # Update metadata
            if 'caches' not in self._metadata:
                self._metadata['caches'] = {}
            
            last_date = None
            if 'period_date' in df.columns:
                last_date = str(df['period_date'].max())
            
            self._metadata['caches'][geo_type] = {
                'record_count': len(df),
                'last_date': last_date,
                'last_updated': datetime.utcnow().isoformat(),
            }
            self._save_metadata()
            
            logger.info(f"Saved {len(df)} records to cache for {geo_type}")
        except Exception as e:
            logger.error(f"Failed to save cache for {geo_type}: {e}")
            raise

    def fetch_full_dataset(
        self,
        geo_type: str,
        columns: list[str] = None,
        batch_size: int = 1000,  # Match Supabase default row limit
    ) -> pd.DataFrame:
        """
        Fetch complete dataset from database using pagination.
        
        Args:
            geo_type: Geography type to fetch
            columns: Columns to select (default: all score-related)
            batch_size: Records per batch (max 1000 due to Supabase limit)
            
        Returns:
            DataFrame with all records
        """
        import time
        fetch_start = time.time()
        
        logger.info("=" * 60)
        logger.info(f"FETCH_FULL_DATASET: Starting for {geo_type}")
        logger.info("=" * 60)
        
        if columns is None:
            columns = list(self._SCORES_HISTORY_COLUMNS)
        else:
            # Only request columns that exist on propertyiq_scores_history
            columns = [c for c in columns if c in self._SCORES_HISTORY_COLUMNS]
        if not columns:
            columns = list(self._SCORES_HISTORY_COLUMNS)
        
        logger.info(f"  Columns to fetch: {columns}")
        
        # Supabase has a default limit of 1000 rows per request
        # Don't exceed this or pagination will break
        batch_size = min(batch_size, 1000)
        logger.info(f"  Batch size: {batch_size}")
        
        # Get total count first for progress tracking
        logger.info(f"  Getting total count for {geo_type}...")
        total_count = self.get_total_count(geo_type)
        logger.info(f"  Total count: {total_count:,} records")
        
        if total_count == 0:
            logger.error(f"FETCH_FULL_DATASET: Total count is 0 for {geo_type}! Check database.")
            self._update_progress(geo_type, 0, 0, "empty")
            return pd.DataFrame()
        
        # Initialize progress
        self._update_progress(geo_type, 0, total_count, "running")
        
        all_data = []
        offset = 0
        batch_num = 0
        consecutive_errors = 0
        max_consecutive_errors = 3
        
        while True:
            batch_num += 1
            batch_start = time.time()
            
            try:
                # Build query step by step for supabase-py v2 compatibility
                logger.debug(f"  Batch {batch_num}: offset={offset}, range={offset}-{offset + batch_size - 1}")
                # Enforce allowlist so we never request non-existent columns (e.g. geography_name)
                safe_columns = [c for c in columns if c in self._SCORES_HISTORY_COLUMNS] or list(self._SCORES_HISTORY_COLUMNS)
                query = self.supabase.table('propertyiq_scores_history').select(','.join(safe_columns))
                query = query.eq('geography_type', geo_type)
                query = query.order('period_date', desc=False)
                query = query.range(offset, offset + batch_size - 1)
                
                response = query.execute()
                batch_count = len(response.data) if response.data else 0
                batch_elapsed = time.time() - batch_start
                
                # Log first batch in detail for debugging
                if batch_num == 1:
                    logger.info(f"  FIRST BATCH RESULT:")
                    logger.info(f"    Records returned: {batch_count}")
                    logger.info(f"    Time: {batch_elapsed:.2f}s")
                    if response.data:
                        logger.info(f"    Sample record keys: {list(response.data[0].keys())}")
                    else:
                        logger.error(f"    NO DATA IN FIRST BATCH! This indicates a problem.")
                
                consecutive_errors = 0  # Reset on success
                
            except Exception as e:
                batch_elapsed = time.time() - batch_start
                consecutive_errors += 1
                logger.error(f"  BATCH {batch_num} ERROR (attempt {consecutive_errors}/{max_consecutive_errors}):")
                logger.error(f"    Offset: {offset}")
                logger.error(f"    Error type: {type(e).__name__}")
                logger.error(f"    Error message: {str(e)}")
                logger.error(f"    Time before error: {batch_elapsed:.2f}s")
                logger.error(f"    Full traceback:", exc_info=True)
                
                if consecutive_errors >= max_consecutive_errors:
                    logger.error(f"  ABORTING: {max_consecutive_errors} consecutive errors")
                    self._update_progress(geo_type, len(all_data), total_count, "error")
                    break
                
                # Continue to next batch on error
                offset += batch_size
                continue
            
            if not response.data:
                logger.info(f"  Batch {batch_num}: No more data (offset={offset})")
                break
            
            all_data.extend(response.data)
            
            # Update progress
            self._update_progress(geo_type, len(all_data), total_count, "running")
            
            # Log progress every 50 batches (50,000 records) OR first 5 batches
            if batch_num <= 5 or len(all_data) % 50000 < batch_size:
                pct = len(all_data) / total_count * 100 if total_count > 0 else 0
                elapsed = time.time() - fetch_start
                rate = len(all_data) / elapsed if elapsed > 0 else 0
                eta = (total_count - len(all_data)) / rate if rate > 0 else 0
                logger.info(f"  {geo_type}: {len(all_data):,} / {total_count:,} ({pct:.1f}%) "
                           f"- {rate:.0f} rec/s - ETA: {eta:.0f}s")
            
            # If we got fewer than batch_size, we've reached the end
            if batch_count < batch_size:
                logger.info(f"  Batch {batch_num}: Got {batch_count} < {batch_size}, reached end")
                break
            
            offset += batch_size
        
        total_elapsed = time.time() - fetch_start
        
        if not all_data:
            logger.error(f"FETCH_FULL_DATASET: FAILED - No data fetched for {geo_type} after {total_elapsed:.1f}s")
            logger.error(f"  Total batches attempted: {batch_num}")
            logger.error(f"  Expected count was: {total_count:,}")
            self._update_progress(geo_type, 0, total_count, "empty")
            return pd.DataFrame()
        
        # Mark as complete
        self._update_progress(geo_type, len(all_data), total_count, "complete")
        
        df = pd.DataFrame(all_data)
        logger.info("=" * 60)
        logger.info(f"FETCH_FULL_DATASET: COMPLETED {geo_type}")
        logger.info(f"  Total records: {len(df):,}")
        logger.info(f"  Total time: {total_elapsed:.1f}s")
        logger.info(f"  Rate: {len(df) / total_elapsed:.0f} records/s")
        logger.info("=" * 60)
        return df

    def fetch_incremental(
        self,
        geo_type: str,
        columns: list[str] = None,
        batch_size: int = 1000,  # Match Supabase default row limit
    ) -> pd.DataFrame:
        """
        Fetch only new records since last cache update.
        
        Args:
            geo_type: Geography type to fetch
            columns: Columns to select
            batch_size: Records per batch (max 1000 due to Supabase limit)
            
        Returns:
            DataFrame with new records only
        """
        last_date = self.get_last_cached_date(geo_type)
        
        if not last_date:
            logger.info(f"No cache for {geo_type}, fetching full dataset")
            return self.fetch_full_dataset(geo_type, columns, batch_size)
        
        if columns is None:
            columns = list(self._SCORES_HISTORY_COLUMNS)
        else:
            columns = [c for c in columns if c in self._SCORES_HISTORY_COLUMNS]
        if not columns:
            columns = list(self._SCORES_HISTORY_COLUMNS)
        
        # Supabase has a default limit of 1000 rows per request
        batch_size = min(batch_size, 1000)
        
        logger.info(f"Fetching incremental data for {geo_type} since {last_date}")
        
        all_data = []
        offset = 0
        
        safe_columns = [c for c in columns if c in self._SCORES_HISTORY_COLUMNS] or list(self._SCORES_HISTORY_COLUMNS)
        while True:
            try:
                # Build query step by step for supabase-py v2 compatibility
                query = self.supabase.table('propertyiq_scores_history').select(','.join(safe_columns))
                query = query.eq('geography_type', geo_type)
                query = query.gt('period_date', last_date)
                query = query.order('period_date', desc=False)
                query = query.range(offset, offset + batch_size - 1)
                response = query.execute()
            except Exception as e:
                logger.error(f"Error fetching incremental batch: {e}")
                break
            
            if not response.data:
                break
            
            all_data.extend(response.data)
            batch_count = len(response.data)
            
            if batch_count < batch_size:
                break
            
            offset += batch_size
        
        if not all_data:
            logger.info(f"No new records for {geo_type}")
            return pd.DataFrame()
        
        df = pd.DataFrame(all_data)
        logger.info(f"Fetched {len(df)} new records for {geo_type}")
        return df

    def sync_cache(
        self,
        geo_type: str,
        force_full: bool = False,
    ) -> Dict[str, Any]:
        """
        Synchronize cache with database.
        
        Args:
            geo_type: Geography type to sync
            force_full: Force full refresh even if cache exists
            
        Returns:
            Sync result summary
        """
        result = {
            'geo_type': geo_type,
            'action': None,
            'records_fetched': 0,
            'total_records': 0,
            'success': False,
        }
        
        try:
            logger.info(f"sync_cache called for {geo_type}, force_full={force_full}, is_cached={self.is_cached(geo_type)}")
            
            if force_full or not self.is_cached(geo_type):
                # Full fetch
                result['action'] = 'full_fetch'
                logger.info(f"Performing full fetch for {geo_type}...")
                
                df = self.fetch_full_dataset(geo_type)
                logger.info(f"fetch_full_dataset returned {len(df)} records for {geo_type}")
                
                if len(df) > 0:
                    self.save_to_cache(geo_type, df)
                    result['records_fetched'] = len(df)
                    result['total_records'] = len(df)
                    result['success'] = True
                    logger.info(f"Successfully cached {len(df)} records for {geo_type}")
                else:
                    result['error'] = f"No data returned from database for {geo_type}"
                    logger.warning(f"No data returned from database for {geo_type}")
            else:
                # Incremental fetch
                result['action'] = 'incremental'
                logger.info(f"Performing incremental fetch for {geo_type}...")
                
                # Load existing cache
                cached_df = self.load_from_cache(geo_type)
                logger.info(f"Loaded {len(cached_df) if cached_df is not None else 0} existing records for {geo_type}")
                
                # Fetch new records
                new_df = self.fetch_incremental(geo_type)
                result['records_fetched'] = len(new_df)
                logger.info(f"Fetched {len(new_df)} new records for {geo_type}")
                
                if len(new_df) > 0:
                    # Combine and save
                    if cached_df is not None:
                        combined = pd.concat([cached_df, new_df], ignore_index=True)
                        # Remove duplicates by id
                        combined = combined.drop_duplicates(subset=['id'], keep='last')
                    else:
                        combined = new_df
                    
                    self.save_to_cache(geo_type, combined)
                    result['total_records'] = len(combined)
                else:
                    result['total_records'] = len(cached_df) if cached_df is not None else 0
                
                result['success'] = True
                
        except Exception as e:
            logger.error(f"Cache sync failed for {geo_type}: {e}", exc_info=True)
            result['error'] = str(e)
        
        logger.info(f"sync_cache result for {geo_type}: {result}")
        return result

    def sync_all(self, force_full: bool = False) -> Dict[str, Any]:
        """Synchronize all geography types."""
        results = {}
        
        for geo_type in ['state', 'metro', 'county', 'zip']:
            logger.info(f"Syncing cache for {geo_type}...")
            results[geo_type] = self.sync_cache(geo_type, force_full)
        
        return results

    def get_cached_data(
        self,
        geo_type: str,
        auto_sync: bool = True,
        enrich_names: bool = True,
    ) -> Optional[pd.DataFrame]:
        """
        Get data for geography type, syncing if needed.
        
        Args:
            geo_type: Geography type
            auto_sync: Automatically sync if cache is empty
            enrich_names: Add geography_name column from crosswalk (default: True)
            
        Returns:
            DataFrame or None (with geography_name if enrich_names=True)
        """
        df = None
        
        if self.is_cached(geo_type):
            df = self.load_from_cache(geo_type)
        elif auto_sync:
            logger.info(f"Cache empty for {geo_type}, syncing...")
            self.sync_cache(geo_type)
            df = self.load_from_cache(geo_type)
        
        # Enrich with geography names from crosswalk
        if df is not None and enrich_names:
            df = self._enrich_with_geography_names(df, geo_type)
        
        return df

    def clear_cache(self, geo_type: str = None):
        """Clear cache for specific geography or all."""
        if geo_type:
            cache_path = self._get_cache_path(geo_type)
            if cache_path.exists():
                cache_path.unlink()
                if 'caches' in self._metadata and geo_type in self._metadata['caches']:
                    del self._metadata['caches'][geo_type]
                self._save_metadata()
                logger.info(f"Cleared cache for {geo_type}")
        else:
            for geo in ['state', 'metro', 'county', 'zip']:
                self.clear_cache(geo)


# Singleton instance
_data_cache: Optional[DataCache] = None


def get_data_cache() -> DataCache:
    """Get or create data cache singleton."""
    global _data_cache
    if _data_cache is None:
        logger.info("Creating new DataCache singleton...")
        _data_cache = DataCache()
    return _data_cache


def reset_data_cache():
    """Reset the singleton (useful for testing or after errors)."""
    global _data_cache
    _data_cache = None
    logger.info("DataCache singleton reset")
