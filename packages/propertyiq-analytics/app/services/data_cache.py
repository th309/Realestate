"""
Data Cache Service - Parquet-based caching for historical data

Provides incremental data loading:
1. Initial load: Fetch all historical data and cache to Parquet
2. Incremental updates: Only fetch new records since last cache
3. Fast reads: Load from local Parquet files instead of database
"""

import logging
import os
import json
from datetime import datetime, date
from pathlib import Path
from typing import Optional, Dict, Any

import pandas as pd
from supabase import create_client, Client

from app.config import get_settings

logger = logging.getLogger(__name__)


class DataCache:
    """
    Parquet-based cache for PropertyIQ historical data.
    
    Supports incremental updates to avoid re-fetching entire dataset.
    """
    
    def __init__(self, cache_dir: str = None):
        """Initialize cache with specified directory."""
        self.settings = get_settings()
        self._supabase: Optional[Client] = None
        
        # Default cache directory (can be mounted as Railway volume)
        self.cache_dir = Path(cache_dir or os.environ.get(
            'CACHE_DIR', 
            '/data/cache'
        ))
        
        # Create cache directory if it doesn't exist
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        self.metadata_file = self.cache_dir / 'cache_metadata.json'
        self._metadata = self._load_metadata()
        
        logger.info(f"DataCache initialized at {self.cache_dir}")

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
        batch_size: int = 10000,
    ) -> pd.DataFrame:
        """
        Fetch complete dataset from database using pagination.
        
        Args:
            geo_type: Geography type to fetch
            columns: Columns to select (default: all score-related)
            batch_size: Records per batch
            
        Returns:
            DataFrame with all records
        """
        if columns is None:
            columns = [
                'id', 'geography_id', 'geography_type', 'period_date',
                'investoredge_score', 'homeready_score', 'market_health_score',
                'actual_appreciation_6m', 'actual_appreciation_12m',
                'actual_appreciation_36m', 'actual_appreciation_60m',
            ]
        
        all_data = []
        offset = 0
        
        logger.info(f"Fetching full dataset for {geo_type}...")
        
        while True:
            logger.info(f"  Batch at offset {offset}...")
            
            try:
                response = self.supabase.table('propertyiq_scores_history') \
                    .select(','.join(columns)) \
                    .eq('geography_type', geo_type) \
                    .order('period_date') \
                    .range(offset, offset + batch_size - 1) \
                    .execute()
            except Exception as e:
                logger.error(f"Error fetching batch at offset {offset}: {e}")
                break
            
            if not response.data:
                break
            
            all_data.extend(response.data)
            logger.info(f"  Fetched {len(response.data)} records (total: {len(all_data)})")
            
            if len(response.data) < batch_size:
                break
            
            offset += batch_size
        
        if not all_data:
            logger.warning(f"No data found for {geo_type}")
            return pd.DataFrame()
        
        df = pd.DataFrame(all_data)
        logger.info(f"Total: {len(df)} records for {geo_type}")
        return df

    def fetch_incremental(
        self,
        geo_type: str,
        columns: list[str] = None,
        batch_size: int = 10000,
    ) -> pd.DataFrame:
        """
        Fetch only new records since last cache update.
        
        Args:
            geo_type: Geography type to fetch
            columns: Columns to select
            batch_size: Records per batch
            
        Returns:
            DataFrame with new records only
        """
        last_date = self.get_last_cached_date(geo_type)
        
        if not last_date:
            logger.info(f"No cache for {geo_type}, fetching full dataset")
            return self.fetch_full_dataset(geo_type, columns, batch_size)
        
        if columns is None:
            columns = [
                'id', 'geography_id', 'geography_type', 'period_date',
                'investoredge_score', 'homeready_score', 'market_health_score',
                'actual_appreciation_6m', 'actual_appreciation_12m',
                'actual_appreciation_36m', 'actual_appreciation_60m',
            ]
        
        logger.info(f"Fetching incremental data for {geo_type} since {last_date}")
        
        all_data = []
        offset = 0
        
        while True:
            try:
                response = self.supabase.table('propertyiq_scores_history') \
                    .select(','.join(columns)) \
                    .eq('geography_type', geo_type) \
                    .gt('period_date', last_date) \
                    .order('period_date') \
                    .range(offset, offset + batch_size - 1) \
                    .execute()
            except Exception as e:
                logger.error(f"Error fetching incremental batch: {e}")
                break
            
            if not response.data:
                break
            
            all_data.extend(response.data)
            
            if len(response.data) < batch_size:
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
            if force_full or not self.is_cached(geo_type):
                # Full fetch
                result['action'] = 'full_fetch'
                df = self.fetch_full_dataset(geo_type)
                
                if len(df) > 0:
                    self.save_to_cache(geo_type, df)
                    result['records_fetched'] = len(df)
                    result['total_records'] = len(df)
                    result['success'] = True
            else:
                # Incremental fetch
                result['action'] = 'incremental'
                
                # Load existing cache
                cached_df = self.load_from_cache(geo_type)
                
                # Fetch new records
                new_df = self.fetch_incremental(geo_type)
                result['records_fetched'] = len(new_df)
                
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
            logger.error(f"Cache sync failed for {geo_type}: {e}")
            result['error'] = str(e)
        
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
    ) -> Optional[pd.DataFrame]:
        """
        Get data for geography type, syncing if needed.
        
        Args:
            geo_type: Geography type
            auto_sync: Automatically sync if cache is empty
            
        Returns:
            DataFrame or None
        """
        if self.is_cached(geo_type):
            return self.load_from_cache(geo_type)
        
        if auto_sync:
            logger.info(f"Cache empty for {geo_type}, syncing...")
            self.sync_cache(geo_type)
            return self.load_from_cache(geo_type)
        
        return None

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
        _data_cache = DataCache()
    return _data_cache
