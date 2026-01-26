"""
Market Data Cache - preload most recent data from market tables.

Loads latest snapshot of Zillow, Realtor, Census, Economic, PropertyIQ scores,
and related tables so Quinn can serve ~90% of queries from cache without
hitting the database. Most user queries use current/latest data.
"""

import logging
import os
from typing import Optional, Dict, Any, List

import pandas as pd
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# Preload most recent data for all tables, all geographic levels.
# Each source has metro/county/zip/state (and national/city/neighborhood where applicable).
TABLES_TO_PRELOAD = [
    # Realtor (all geo levels)
    "realtor_metro", "realtor_county", "realtor_zip", "realtor_state", "realtor_national",
    # Zillow (all geo levels + metro crosswalk for region_id <-> CBSA)
    "zillow_metro", "zillow_county", "zillow_zip", "zillow_state",
    "zillow_city", "zillow_neighborhood", "zillow_metro_crosswalk",
    # Census (all geo levels)
    "census_metro", "census_county", "census_zip", "census_state",
    "census_city", "census_national",
    # Calculated metrics
    "calculated_metrics",
    # Economic (all geo levels)
    "economic_metro", "economic_county", "economic_state", "economic_national",
    # HUD
    "hud_fmr",
    # Permits (all geo levels: state, metro, county)
    "permits_state", "permits_metro", "permits_county",
    # PropertyIQ (current snapshot + latest period of history, all geos in one table)
    "propertyiq_scores", "propertyiq_scores_history",
]

# Time-series: cache only latest period (max period_date). Others: full table up to MAX_ROWS.
DATE_COLUMN = "period_date"
TIME_SERIES_TABLES = {
    "realtor_metro", "realtor_county", "realtor_zip", "realtor_state", "realtor_national",
    "zillow_metro", "zillow_county", "zillow_zip", "zillow_state",
    "zillow_city", "zillow_neighborhood",
    "census_metro", "census_county", "census_zip", "census_state",
    "census_city", "census_national",
    "economic_metro", "economic_county", "economic_state", "economic_national",
    "hud_fmr",
    "permits_state", "permits_metro", "permits_county",
    "propertyiq_scores_history",
}

MAX_ROWS_FULL_TABLE = 20_000  # for geographies, propertyiq_scores, calculated_metrics
BATCH_SIZE = 1000  # Supabase default limit


class MarketDataCache:
    """In-memory cache of most recent market data per table."""

    def __init__(self):
        self._client: Optional[Client] = None
        self._cache: Dict[str, pd.DataFrame] = {}
        self._loaded_at: Dict[str, str] = {}
        logger.info("MarketDataCache initialized")

    @property
    def client(self) -> Client:
        if self._client is None:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
            if not url or not key:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY required")
            self._client = create_client(url, key)
        return self._client

    def get(self, table_name: str) -> Optional[pd.DataFrame]:
        """Return cached DataFrame for table, or None if not loaded."""
        return self._cache.get(table_name)

    def is_cached(self, table_name: str) -> bool:
        return table_name in self._cache and self._cache[table_name] is not None and len(self._cache[table_name]) > 0

    def get_status(self) -> Dict[str, Any]:
        """Return status of each preloadable table."""
        from datetime import datetime
        status = {"tables": {}, "summary": {"cached": 0, "total": len(TABLES_TO_PRELOAD)}}
        for t in TABLES_TO_PRELOAD:
            df = self._cache.get(t)
            status["tables"][t] = {
                "cached": df is not None and len(df) > 0,
                "rows": len(df) if df is not None else 0,
                "loaded_at": self._loaded_at.get(t),
            }
            if status["tables"][t]["cached"]:
                status["summary"]["cached"] += 1
        return status

    def load_table(self, table_name: str) -> bool:
        """Load latest data for one table. Returns True on success."""
        if table_name not in TABLES_TO_PRELOAD:
            logger.warning(f"MarketDataCache: table {table_name} not in TABLES_TO_PRELOAD")
            return False
        try:
            if table_name in TIME_SERIES_TABLES:
                df = self._fetch_latest_period(table_name)
            else:
                df = self._fetch_full_table(table_name)
            if df is not None and len(df) > 0:
                self._cache[table_name] = df
                from datetime import datetime
                self._loaded_at[table_name] = datetime.utcnow().isoformat()
                logger.info(f"MarketDataCache: loaded {table_name} ({len(df)} rows)")
                return True
            else:
                logger.warning(f"MarketDataCache: no data for {table_name}")
                return False
        except Exception as e:
            logger.exception(f"MarketDataCache: failed to load {table_name}: {e}")
            return False

    def _fetch_latest_period(self, table_name: str) -> Optional[pd.DataFrame]:
        """Fetch all rows for the most recent period_date."""
        # Get max date
        try:
            r = self.client.table(table_name).select(DATE_COLUMN).order(DATE_COLUMN, desc=True).limit(1).execute()
        except Exception as e:
            # Some tables might use different date column
            logger.warning(f"MarketDataCache: no {DATE_COLUMN} in {table_name}, trying full fetch: {e}")
            return self._fetch_full_table(table_name)
        if not r.data:
            return pd.DataFrame()
        max_date = r.data[0][DATE_COLUMN]
        # Fetch all rows with that date (paginated)
        all_data: List[Dict] = []
        offset = 0
        while True:
            q = (
                self.client.table(table_name)
                .select("*")
                .eq(DATE_COLUMN, max_date)
                .range(offset, offset + BATCH_SIZE - 1)
            )
            batch = q.execute()
            if not batch.data:
                break
            all_data.extend(batch.data)
            if len(batch.data) < BATCH_SIZE:
                break
            offset += BATCH_SIZE
        return pd.DataFrame(all_data) if all_data else pd.DataFrame()

    def _fetch_full_table(self, table_name: str) -> Optional[pd.DataFrame]:
        """Fetch table with limit (for reference/snapshot tables)."""
        all_data: List[Dict] = []
        offset = 0
        while offset < MAX_ROWS_FULL_TABLE:
            q = self.client.table(table_name).select("*").range(offset, offset + BATCH_SIZE - 1)
            batch = q.execute()
            if not batch.data:
                break
            all_data.extend(batch.data)
            if len(batch.data) < BATCH_SIZE:
                break
            offset += BATCH_SIZE
        return pd.DataFrame(all_data) if all_data else pd.DataFrame()

    def load_all(self) -> Dict[str, bool]:
        """Load latest data for all market tables. Returns {table: success}."""
        results = {}
        for table in TABLES_TO_PRELOAD:
            try:
                results[table] = self.load_table(table)
            except Exception as e:
                logger.error(f"MarketDataCache: load_all error for {table}: {e}")
                results[table] = False
        return results

    def clear(self, table_name: Optional[str] = None) -> None:
        """Clear cache for one table or all."""
        if table_name:
            self._cache.pop(table_name, None)
            self._loaded_at.pop(table_name, None)
        else:
            self._cache.clear()
            self._loaded_at.clear()


# Singleton
_market_cache: Optional[MarketDataCache] = None


def get_market_data_cache() -> MarketDataCache:
    global _market_cache
    if _market_cache is None:
        _market_cache = MarketDataCache()
    return _market_cache
