"""
Data Cache Service - Direct query layer for PropertyIQ scores

Queries propertyiq_scores (the single source of truth) directly and pivots
normalized rows into the denormalized format expected by downstream consumers.

Also provides geography name enrichment via crosswalk tables.
"""

import logging
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
            df = df.dropna(subset=['cbsa_code'])
            df = df.drop_duplicates(subset=['cbsa_code'])
            logger.info(f"Metro crosswalk loaded: {len(df)} entries")
            return df
    except Exception as e:
        logger.error(f"Metro crosswalk load failed: {e}")
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
            logger.info(f"Geography crosswalk loaded: {len(df)} entries")
            return df
    except Exception as e:
        logger.warning(f"Failed to load geography crosswalk: {e}")
    return pd.DataFrame()


class DataCache:
    """
    Query layer for PropertyIQ scores with geography name enrichment.

    Queries propertyiq_scores directly (no Parquet cache).
    Pivots normalized schema into denormalized format for backward compatibility.
    """

    # Class-level crosswalk caches (loaded once, used for all enrichment)
    _metro_crosswalk: Optional[pd.DataFrame] = None
    _geography_crosswalk: Optional[pd.DataFrame] = None
    _crosswalk_loaded: bool = False

    def __init__(self):
        """Initialize with Supabase client only."""
        self.settings = get_settings()
        self._supabase: Optional[Client] = None
        # In-memory cache: avoid re-querying on every request
        self._memory_cache: Dict[str, pd.DataFrame] = {}
        logger.info("DataCache initialized (direct query mode)")

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

    def _ensure_crosswalks_loaded(self) -> None:
        """Load crosswalk data if not already loaded (lazy initialization)."""
        if DataCache._crosswalk_loaded:
            return

        try:
            DataCache._metro_crosswalk = _load_metro_crosswalk(self.supabase)
            DataCache._geography_crosswalk = _load_geography_crosswalk(self.supabase)
            DataCache._crosswalk_loaded = True

            metro_count = len(DataCache._metro_crosswalk) if DataCache._metro_crosswalk is not None and not DataCache._metro_crosswalk.empty else 0
            geo_count = len(DataCache._geography_crosswalk) if DataCache._geography_crosswalk is not None and not DataCache._geography_crosswalk.empty else 0
            logger.info(f"Crosswalks loaded: {metro_count} metros, {geo_count} geographies")
        except Exception as e:
            logger.error(f"Crosswalk loading failed: {e}")
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

        self._ensure_crosswalks_loaded()
        df = df.copy()

        if 'geography_name' not in df.columns:
            df['geography_name'] = None
        if 'parent_geography_id' not in df.columns:
            df['parent_geography_id'] = None

        if geo_type == 'metro':
            if DataCache._metro_crosswalk is not None and len(DataCache._metro_crosswalk) > 0:
                crosswalk = DataCache._metro_crosswalk.copy()
                crosswalk = crosswalk.rename(columns={
                    'cbsa_code': 'geography_id',
                    'cbsa_title': 'geography_name_lookup'
                })
                df = df.merge(
                    crosswalk[['geography_id', 'geography_name_lookup']],
                    on='geography_id',
                    how='left'
                )
                df['geography_name'] = df['geography_name_lookup'].combine_first(df['geography_name'])
                df = df.drop(columns=['geography_name_lookup'], errors='ignore')

                def extract_state(name):
                    if pd.isna(name):
                        return None
                    import re
                    match = re.search(r',\s*([A-Z]{2})(?:-[A-Z]{2})*$', str(name))
                    return match.group(1) if match else None

                df['parent_geography_id'] = df['geography_name'].apply(extract_state)

        elif geo_type == 'state':
            if DataCache._geography_crosswalk is not None and len(DataCache._geography_crosswalk) > 0:
                state_map = (
                    DataCache._geography_crosswalk[['state_abbrev', 'state_name']]
                    .drop_duplicates()
                    .rename(columns={'state_abbrev': 'geography_id', 'state_name': 'geography_name_lookup'})
                )
                df = df.merge(state_map, on='geography_id', how='left')
                df['geography_name'] = df['geography_name_lookup'].combine_first(df['geography_name'])
                df = df.drop(columns=['geography_name_lookup'], errors='ignore')

        elif geo_type == 'county':
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
                df['geography_name'] = df.apply(
                    lambda row: f"{row['county_name_lookup']}, {row['state_lookup']}"
                    if pd.notna(row.get('county_name_lookup')) and pd.notna(row.get('state_lookup'))
                    else row.get('geography_name'),
                    axis=1
                )
                df['parent_geography_id'] = df['state_lookup'].combine_first(df['parent_geography_id'])
                df = df.drop(columns=['county_name_lookup', 'state_lookup'], errors='ignore')

        elif geo_type == 'zip':
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
                df['geography_name'] = df.apply(
                    lambda row: f"{row['city_lookup']}, {row['state_lookup']} {row['geography_id']}"
                    if pd.notna(row.get('city_lookup')) and pd.notna(row.get('state_lookup'))
                    else row.get('geography_name'),
                    axis=1
                )
                df['parent_geography_id'] = df['state_lookup'].combine_first(df['parent_geography_id'])
                df = df.drop(columns=['city_lookup', 'state_lookup'], errors='ignore')

        # Fallback: use geography_id as name if still null
        df['geography_name'] = df['geography_name'].fillna(df['geography_id'])

        return df

    def _fetch_and_pivot(self, geo_type: str, latest_only: bool = True) -> Optional[pd.DataFrame]:
        """
        Query propertyiq_scores and pivot normalized rows into denormalized format.

        Normalized (DB): one row per (location_id, score_type, score_date)
        Denormalized (returned): one row per (geography_id, period_date) with
            homeready_score, investoredge_score, market_health_score columns.
        """
        try:
            if latest_only:
                # Get the latest score_date for this geography level
                date_resp = (
                    self.supabase.table('propertyiq_scores')
                    .select('score_date')
                    .eq('geography', geo_type)
                    .order('score_date', desc=True)
                    .limit(1)
                    .execute()
                )
                if not date_resp.data:
                    logger.warning(f"No scores found for geography={geo_type}")
                    return None
                latest_date = date_resp.data[0]['score_date']
                date_filter = latest_date
            else:
                date_filter = None

            # Fetch rows in batches
            all_data = []
            offset = 0
            batch_size = 1000

            while True:
                query = (
                    self.supabase.table('propertyiq_scores')
                    .select('location_id, location_name, score_type, score, score_date')
                    .eq('geography', geo_type)
                )
                if date_filter:
                    query = query.eq('score_date', date_filter)

                query = query.range(offset, offset + batch_size - 1)
                resp = query.execute()

                if not resp.data:
                    break
                all_data.extend(resp.data)
                if len(resp.data) < batch_size:
                    break
                offset += batch_size

            if not all_data:
                return None

            df = pd.DataFrame(all_data)

            # Rename to match downstream column expectations
            df = df.rename(columns={
                'location_id': 'geography_id',
                'score_date': 'period_date',
            })

            # Preserve location_name before pivot (take first non-null per geography)
            name_map = df.drop_duplicates(subset=['geography_id'])[['geography_id', 'location_name']]

            # Pivot: score_type values become columns
            pivoted = df.pivot_table(
                index=['geography_id', 'period_date'],
                columns='score_type',
                values='score',
                aggfunc='first'
            ).reset_index()

            # Flatten MultiIndex columns
            pivoted.columns.name = None

            # Rename score columns to match legacy format
            score_rename = {
                'homeready': 'homeready_score',
                'investoredge': 'investoredge_score',
                'markethealth': 'market_health_score',
            }
            pivoted = pivoted.rename(columns=score_rename)

            # Re-attach location_name
            pivoted = pivoted.merge(name_map, on='geography_id', how='left')

            logger.info(f"Fetched {len(pivoted)} {geo_type} records from propertyiq_scores (latest_only={latest_only})")
            return pivoted

        except Exception as e:
            logger.error(f"Failed to fetch/pivot propertyiq_scores for {geo_type}: {e}", exc_info=True)
            return None

    def get_cached_data(
        self,
        geo_type: str,
        auto_sync: bool = True,
        enrich_names: bool = True,
        latest_only: bool = True,
    ) -> Optional[pd.DataFrame]:
        """
        Get score data for a geography type by querying propertyiq_scores directly.

        Pivots normalized rows into denormalized format for backward compatibility.
        Results are cached in memory for fast repeat access.

        Args:
            geo_type: Geography level (state, metro, county, zip)
            auto_sync: Ignored (kept for API compatibility)
            enrich_names: Whether to join crosswalk names
            latest_only: If True, only return the most recent score date
        """
        cache_key = f"{geo_type}_{'latest' if latest_only else 'all'}"

        # Serve from memory if already loaded
        if cache_key in self._memory_cache:
            logger.debug(f"Serving {geo_type} from memory cache ({len(self._memory_cache[cache_key])} records)")
            return self._memory_cache[cache_key]

        df = self._fetch_and_pivot(geo_type, latest_only=latest_only)

        if df is not None and enrich_names:
            df = self._enrich_with_geography_names(df, geo_type)

        # Cache in memory for fast repeat access
        if df is not None:
            self._memory_cache[cache_key] = df

        return df

    def clear_cache(self, geo_type: str = None):
        """Clear in-memory cache."""
        if geo_type:
            keys_to_remove = [k for k in self._memory_cache if k.startswith(geo_type)]
            for k in keys_to_remove:
                del self._memory_cache[k]
            logger.info(f"Cleared memory cache for {geo_type}")
        else:
            self._memory_cache.clear()
            logger.info("Cleared all memory caches")

    def get_cache_status(self) -> Dict[str, Any]:
        """Get status of in-memory caches."""
        return {
            'mode': 'direct_query',
            'source_table': 'propertyiq_scores',
            'memory_cache_keys': list(self._memory_cache.keys()),
            'memory_cache_sizes': {
                k: len(v) for k, v in self._memory_cache.items()
            },
        }

    # ------------------------------------------------------------------
    # Backward-compatible stubs for callers that used the old Parquet API
    # ------------------------------------------------------------------

    def validate_connection(self, timeout_seconds: int = 30) -> dict:
        """Validate Supabase connectivity (no Parquet cache to check)."""
        try:
            resp = (
                self.supabase.table('propertyiq_scores')
                .select('score_date')
                .limit(1)
                .execute()
            )
            return {
                "success": bool(resp.data),
                "message": "Connection validated (direct query mode)",
                "details": {"mode": "direct_query", "source": "propertyiq_scores"},
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Connection failed: {e}",
                "details": {"error": str(e)},
            }

    def is_cached(self, geo_type: str) -> bool:
        """Always True — data is served via direct query, no Parquet needed."""
        return True

    def sync_cache(self, geo_type: str, force_full: bool = False) -> Dict[str, Any]:
        """No-op — no Parquet cache to sync. Clears memory cache to force re-query."""
        self.clear_cache(geo_type)
        return {
            'geo_type': geo_type,
            'action': 'no_op_direct_query',
            'success': True,
            'message': 'Direct query mode — no sync needed. Memory cache cleared.',
        }

    def sync_all(self, force_full: bool = False) -> Dict[str, Any]:
        """No-op — clears all memory caches."""
        self.clear_cache()
        return {
            geo: self.sync_cache(geo) for geo in ['state', 'metro', 'county', 'zip']
        }

    def get_export_progress(self) -> Dict[str, Any]:
        """No export in direct query mode."""
        return {}

    def load_from_cache(self, geo_type: str) -> Optional[pd.DataFrame]:
        """Delegate to get_cached_data (no Parquet files)."""
        return self.get_cached_data(geo_type, enrich_names=True, latest_only=True)

    def get_total_count(self, geo_type: str) -> int:
        """Get count of unique geographies for a level from propertyiq_scores."""
        try:
            resp = (
                self.supabase.table('propertyiq_scores')
                .select('location_id', count='exact')
                .eq('geography', geo_type)
                .eq('score_type', 'homeready')
                .limit(0)
                .execute()
            )
            return resp.count or 0
        except Exception as e:
            logger.error(f"get_total_count failed for {geo_type}: {e}")
            return 0

    def reset_progress(self):
        """No-op — no export progress to reset."""
        pass

    def save_to_cache(self, geo_type: str, df: pd.DataFrame):
        """No-op — no Parquet files to write. Stores in memory cache instead."""
        cache_key = f"{geo_type}_latest"
        self._memory_cache[cache_key] = df
        logger.info(f"Stored {len(df)} records in memory cache for {geo_type}")


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
