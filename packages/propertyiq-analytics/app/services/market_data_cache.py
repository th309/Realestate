"""
Market Data Cache - Parquet-backed market data for fast Quinn responses.

Stores time-series data in Parquet under CACHE_DIR/market. Startup reads from
Parquet only (fast). Weekly job at 4am EST does incremental refresh from
Supabase; writes use temp-then-rename so reads always see a consistent file.

- Time-series tables: incremental fetch (period_date > max in Parquet), then
  trim to retention (24 months for all tables including PropertyIQ scores).
- Full-table: zillow_metro_crosswalk only; full replace on refresh.
"""

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List

import pandas as pd
from supabase import create_client, Client

logger = logging.getLogger(__name__)

MARKET_CACHE_SUBDIR = "market"
DATE_COLUMN = "period_date"

# Default retention for time-series (months). Override per-table below.
RECENT_MONTHS = 24
# PropertyIQ scores: keep 2 years in Parquet (same as other tables to avoid OOM).
PROPERTYIQ_RETENTION_MONTHS = 24
RETENTION_MONTHS_BY_TABLE: Dict[str, int] = {
    "propertyiq_scores": PROPERTYIQ_RETENTION_MONTHS,
    "propertyiq_scores_history": PROPERTYIQ_RETENTION_MONTHS,
}

TABLES_TO_PRELOAD = [
    "realtor_metro", "realtor_county", "realtor_zip", "realtor_state", "realtor_national",
    "zillow_metro", "zillow_county", "zillow_zip", "zillow_state",
    "zillow_city", "zillow_neighborhood", "zillow_metro_crosswalk",
    "census_metro", "census_county", "census_zip", "census_state",
    "census_city", "census_national",
    "calculated_metrics",
    "economic_metro", "economic_county", "economic_state", "economic_national",
    "hud_fmr",
    "permits_state", "permits_county",
    "propertyiq_scores", "propertyiq_scores_history",
]

# Time-series: incremental refresh, trim to retention. calculated_metrics + PropertyIQ included.
TIME_SERIES_TABLES = {
    "realtor_metro", "realtor_county", "realtor_zip", "realtor_state", "realtor_national",
    "zillow_metro", "zillow_county", "zillow_zip", "zillow_state",
    "zillow_city", "zillow_neighborhood",
    "census_metro", "census_county", "census_zip", "census_state",
    "census_city", "census_national",
    "calculated_metrics",
    "economic_metro", "economic_county", "economic_state", "economic_national",
    "hud_fmr",
    "permits_state", "permits_county",
    "propertyiq_scores", "propertyiq_scores_history",
}

# No period_date; full table replace on refresh.
FULL_TABLE_TABLES = {"zillow_metro_crosswalk"}

SAFETY_MAX_ROWS_PER_TABLE = 2_000_000
BATCH_SIZE = 1000


def _get_retention_months(table_name: str) -> int:
    return RETENTION_MONTHS_BY_TABLE.get(table_name, RECENT_MONTHS)


class MarketDataCache:
    """Parquet-backed cache: read from disk on startup; incremental refresh weekly."""

    def __init__(self):
        self._client: Optional[Client] = None
        self._cache: Dict[str, pd.DataFrame] = {}
        self._loaded_at: Dict[str, str] = {}
        self._cache_dir: Optional[Path] = None
        logger.info("MarketDataCache initialized")

    def _market_dir(self) -> Path:
        if self._cache_dir is not None:
            return self._cache_dir
        base = os.environ.get("CACHE_DIR", "/tmp/cache")
        self._cache_dir = Path(base) / MARKET_CACHE_SUBDIR
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        return self._cache_dir

    def _parquet_path(self, table_name: str) -> Path:
        return self._market_dir() / f"{table_name}.parquet"

    def _read_parquet(self, table_name: str) -> Optional[pd.DataFrame]:
        path = self._parquet_path(table_name)
        if not path.exists():
            return None
        try:
            df = pd.read_parquet(path)
            if df is not None and len(df) > 0:
                return df
        except Exception as e:
            logger.warning(f"MarketDataCache: could not read {path}: {e}")
        return None

    def _write_parquet_atomic(self, table_name: str, df: pd.DataFrame) -> None:
        path = self._parquet_path(table_name)
        tmp = path.with_suffix(".parquet.tmp")
        try:
            df.to_parquet(tmp, index=False)
            os.replace(tmp, path)
        finally:
            if tmp.exists():
                try:
                    tmp.unlink()
                except OSError:
                    pass

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
        return self._cache.get(table_name)

    def is_cached(self, table_name: str) -> bool:
        return (
            table_name in self._cache
            and self._cache[table_name] is not None
            and len(self._cache[table_name]) > 0
        )

    def get_status(self) -> Dict[str, Any]:
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
        """Load one table: from Parquet if present, else fetch from Supabase and write Parquet."""
        if table_name not in TABLES_TO_PRELOAD:
            logger.warning(f"MarketDataCache: table {table_name} not in TABLES_TO_PRELOAD")
            return False
        try:
            df = self._read_parquet(table_name)
            if df is not None and len(df) > 0:
                self._cache[table_name] = df
                self._loaded_at[table_name] = datetime.utcnow().isoformat()
                logger.info(f"MarketDataCache: loaded {table_name} from Parquet ({len(df)} rows)")
                return True
            if table_name in TIME_SERIES_TABLES:
                months = _get_retention_months(table_name)
                df = self._fetch_recent_months(table_name, months)
            else:
                df = self._fetch_full_table(table_name)
            if df is not None and len(df) > 0:
                self._write_parquet_atomic(table_name, df)
                self._cache[table_name] = df
                self._loaded_at[table_name] = datetime.utcnow().isoformat()
                logger.info(f"MarketDataCache: loaded {table_name} from DB ({len(df)} rows)")
                return True
            logger.warning(f"MarketDataCache: no data for {table_name}")
            return False
        except Exception as e:
            logger.exception(f"MarketDataCache: failed to load {table_name}: {e}")
            return False

    def refresh_table_from_supabase(self, table_name: str) -> bool:
        """Incremental (time-series) or full refresh; write Parquet atomic; update in-memory cache."""
        if table_name not in TABLES_TO_PRELOAD:
            return False
        try:
            if table_name in TIME_SERIES_TABLES:
                df = self._fetch_incremental(table_name)
            else:
                df = self._fetch_full_table(table_name)
            if df is not None and len(df) > 0:
                self._write_parquet_atomic(table_name, df)
                self._cache[table_name] = df
                self._loaded_at[table_name] = datetime.utcnow().isoformat()
                logger.info(f"MarketDataCache: refreshed {table_name} ({len(df)} rows)")
                return True
            # Keep existing cache if fetch returned empty (e.g. no new data)
            if self.is_cached(table_name):
                return True
            logger.warning(f"MarketDataCache: no data for {table_name}")
            return False
        except Exception as e:
            logger.exception(f"MarketDataCache: refresh failed for {table_name}: {e}")
            return False

    def _fetch_incremental(self, table_name: str) -> Optional[pd.DataFrame]:
        """Fetch only new rows (period_date > max in Parquet), merge, trim to retention."""
        existing = self._read_parquet(table_name)
        retention = _get_retention_months(table_name)
        max_date_str: Optional[str] = None
        if existing is not None and len(existing) > 0 and DATE_COLUMN in existing.columns:
            max_ts = existing[DATE_COLUMN].max()
            max_date_str = pd.Timestamp(max_ts).strftime("%Y-%m-%d")
        if max_date_str is None:
            return self._fetch_recent_months(table_name, retention)
        new_data: List[Dict] = []
        offset = 0
        while True:
            if SAFETY_MAX_ROWS_PER_TABLE and len(new_data) >= SAFETY_MAX_ROWS_PER_TABLE:
                break
            q = (
                self.client.table(table_name)
                .select("*")
                .gt(DATE_COLUMN, max_date_str)
                .order(DATE_COLUMN, desc=False)
                .range(offset, offset + BATCH_SIZE - 1)
            )
            batch = q.execute()
            if not batch.data:
                break
            new_data.extend(batch.data)
            if len(batch.data) < BATCH_SIZE:
                break
            offset += BATCH_SIZE
        if not new_data:
            if existing is not None and len(existing) > 0:
                df = existing.copy()
                df = self._trim_to_retention(df, retention)
                return df if len(df) > 0 else existing
            return existing
        new_df = pd.DataFrame(new_data)
        combined = pd.concat([existing, new_df], ignore_index=True) if existing is not None and len(existing) > 0 else new_df
        if DATE_COLUMN in combined.columns:
            combined = combined.drop_duplicates(keep="last").sort_values(DATE_COLUMN).reset_index(drop=True)
        combined = self._trim_to_retention(combined, retention)
        logger.info(f"MarketDataCache: {table_name} incremental +{len(new_data)} rows, total {len(combined)}")
        return combined

    def _trim_to_retention(self, df: pd.DataFrame, retention_months: int) -> pd.DataFrame:
        if DATE_COLUMN not in df.columns or len(df) == 0:
            return df
        max_ts = pd.Timestamp(df[DATE_COLUMN].max())
        cutoff = (max_ts - pd.offsets.DateOffset(months=retention_months)).strftime("%Y-%m-%d")
        return df[df[DATE_COLUMN].astype(str) >= cutoff].copy()

    def _fetch_recent_months(self, table_name: str, retention_months: int) -> Optional[pd.DataFrame]:
        try:
            r = self.client.table(table_name).select(DATE_COLUMN).order(DATE_COLUMN, desc=True).limit(1).execute()
        except Exception as e:
            logger.warning(f"MarketDataCache: no {DATE_COLUMN} in {table_name}, full fetch: {e}")
            return self._fetch_full_table(table_name)
        if not r.data:
            return pd.DataFrame()
        max_date_str = r.data[0][DATE_COLUMN]
        try:
            max_ts = pd.Timestamp(max_date_str)
            cutoff_ts = max_ts - pd.offsets.DateOffset(months=retention_months)
            cutoff_str = cutoff_ts.strftime("%Y-%m-%d")
        except Exception:
            cutoff_str = max_date_str
        all_data: List[Dict] = []
        offset = 0
        while True:
            if SAFETY_MAX_ROWS_PER_TABLE and len(all_data) >= SAFETY_MAX_ROWS_PER_TABLE:
                logger.warning(f"MarketDataCache: {table_name} hit safety cap")
                break
            q = (
                self.client.table(table_name)
                .select("*")
                .gte(DATE_COLUMN, cutoff_str)
                .order(DATE_COLUMN, desc=False)
                .range(offset, offset + BATCH_SIZE - 1)
            )
            batch = q.execute()
            if not batch.data:
                break
            all_data.extend(batch.data)
            if len(batch.data) < BATCH_SIZE:
                break
            offset += BATCH_SIZE
        if all_data:
            logger.info(f"MarketDataCache: {table_name} full window {len(all_data)} rows ({retention_months}mo)")
        return pd.DataFrame(all_data) if all_data else pd.DataFrame()

    def _fetch_full_table(self, table_name: str) -> Optional[pd.DataFrame]:
        all_data: List[Dict] = []
        offset = 0
        while True:
            if SAFETY_MAX_ROWS_PER_TABLE and len(all_data) >= SAFETY_MAX_ROWS_PER_TABLE:
                break
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
        """Load all tables from Parquet (fast); only hit DB when Parquet missing."""
        results = {}
        for table in TABLES_TO_PRELOAD:
            try:
                results[table] = self.load_table(table)
            except Exception as e:
                logger.error(f"MarketDataCache: load_all error for {table}: {e}")
                results[table] = False
        return results

    def refresh_all_from_supabase(self) -> Dict[str, bool]:
        """Incremental or full refresh for all tables (weekly job)."""
        results = {}
        for table in TABLES_TO_PRELOAD:
            try:
                results[table] = self.refresh_table_from_supabase(table)
            except Exception as e:
                logger.error(f"MarketDataCache: refresh error for {table}: {e}")
                results[table] = False
        return results

    def clear(self, table_name: Optional[str] = None) -> None:
        if table_name:
            self._cache.pop(table_name, None)
            self._loaded_at.pop(table_name, None)
            path = self._parquet_path(table_name)
            if path.exists():
                try:
                    path.unlink()
                except OSError:
                    pass
        else:
            self._cache.clear()
            self._loaded_at.clear()


_market_cache: Optional[MarketDataCache] = None


def get_market_data_cache() -> MarketDataCache:
    global _market_cache
    if _market_cache is None:
        _market_cache = MarketDataCache()
    return _market_cache
