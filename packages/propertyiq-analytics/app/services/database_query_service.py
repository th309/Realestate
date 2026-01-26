"""
Database Query Service

Provides Quinn with direct read access to Supabase database.
Allows natural language queries to be executed against any table.
Uses market data cache when available to minimize DB load.
"""

import logging
from typing import Optional, List, Dict, Any, Tuple
import os
import re

import pandas as pd
import numpy as np
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class DatabaseQueryService:
    """Service for querying Supabase database directly."""

    # WHITELIST: Real estate data + user's own conversation history
    # Excludes: admin data, other users' data, feature flags, beta tester info
    ALLOWED_TABLES = {
        # Zillow data
        'zillow_metro', 'zillow_county', 'zillow_zip', 'zillow_state',
        'zillow_city', 'zillow_neighborhood', 'zillow_metro_crosswalk',
        # Realtor data
        'realtor_metro', 'realtor_county', 'realtor_zip', 'realtor_state',
        'realtor_national',
        # Census demographic data
        'census_metro', 'census_county', 'census_zip', 'census_state',
        'census_city', 'census_national',
        # Economic indicators
        'economic_metro', 'economic_county', 'economic_state', 'economic_national',
        # PropertyIQ scores (market analysis, not user data)
        'propertyiq_scores', 'propertyiq_scores_history',
        # Calculated metrics
        'calculated_metrics',
        # Geographic reference data
        'geographies', 'geography_inheritance',
        # Market time series
        'market_time_series',
        # HUD Fair Market Rent
        'hud_fmr',
        # Building permits (Census BPS)
        'permits_state', 'permits_metro', 'permits_county',
        # Backtest results (validation data, not user data)
        'backtest_runs', 'backtest_results',
        # TIGER geographic boundaries
        'tiger_national',
        # News cache (market news, not user data)
        'news_cache',
        # User's own analytics data (filtered by user_id at application layer)
        'analytics_conversations', 'analytics_saved_queries',
        'analytics_watchlist', 'analytics_notes', 'analytics_alerts',
    }

    def __init__(self):
        self._client: Optional[Client] = None
        logger.info("DatabaseQueryService initialized with real estate data access only")

    @property
    def client(self) -> Client:
        """Lazy-load Supabase client."""
        if self._client is None:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
            if not url or not key:
                raise ValueError("SUPABASE_URL and SUPABASE_KEY required")
            self._client = create_client(url, key)
        return self._client

    def _validate_table_access(self, table_name: str) -> bool:
        """
        Check if table is in the allowed list.

        Returns:
            True if allowed, False otherwise
        """
        if table_name not in self.ALLOWED_TABLES:
            logger.warning(f"Access denied to table: {table_name}")
            return False
        return True

    def _apply_filters_to_dataframe(
        self, df: pd.DataFrame, filters: Optional[Dict[str, Any]]
    ) -> pd.DataFrame:
        """Apply filters dict to a DataFrame (eq, in_, gte, lte, gt, lt, neq, like, ilike)."""
        if not filters or df.empty:
            return df
        out = df
        for col, value in filters.items():
            if col not in out.columns:
                continue
            if isinstance(value, list):
                out = out[out[col].isin(value)]
            elif isinstance(value, dict):
                for op, val in value.items():
                    if op == "gte":
                        out = out[out[col] >= val]
                    elif op == "lte":
                        out = out[out[col] <= val]
                    elif op == "gt":
                        out = out[out[col] > val]
                    elif op == "lt":
                        out = out[out[col] < val]
                    elif op == "eq":
                        out = out[out[col] == val]
                    elif op == "neq":
                        out = out[out[col] != val]
                    elif op == "like":
                        pat = "^" + re.escape(str(val)).replace("%", ".*").replace("_", ".") + "$"
                        out = out[out[col].astype(str).str.match(pat, na=False)]
                    elif op == "ilike":
                        pat = "^" + re.escape(str(val)).replace("%", ".*").replace("_", ".").lower() + "$"
                        out = out[out[col].astype(str).str.lower().str.match(pat, na=False)]
            else:
                out = out[out[col] == value]
        return out

    def _query_table_from_cache(
        self,
        table_name: str,
        columns: Optional[List[str]] = None,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """
        Run query against in-memory market cache. Returns None if cache not used.
        Return shape matches query_table (success, table, total_count, returned_count, data, limit, offset).
        """
        try:
            from app.services.market_data_cache import get_market_data_cache, TABLES_TO_PRELOAD

            if table_name not in TABLES_TO_PRELOAD:
                return None
            cache = get_market_data_cache()
            if not cache.is_cached(table_name):
                return None
            df = cache.get(table_name)
            if df is None or df.empty:
                return None
        except Exception as e:
            logger.debug(f"Market cache not used for {table_name}: {e}")
            return None

        try:
            # Select columns
            if columns:
                missing = [c for c in columns if c not in df.columns]
                if missing:
                    return None
                df = df[columns].copy()
            else:
                df = df.copy()

            # Filters
            df = self._apply_filters_to_dataframe(df, filters)
            total_count = len(df)

            # Order
            if order_by:
                desc = order_by.startswith("-")
                col = order_by.lstrip("-")
                if col not in df.columns:
                    return None
                df = df.sort_values(by=col, ascending=not desc)

            # Offset and limit
            df = df.iloc[offset : offset + limit]
            data = df.replace({np.nan: None}).to_dict(orient="records")

            return {
                "success": True,
                "table": table_name,
                "total_count": total_count,
                "returned_count": len(data),
                "data": data,
                "limit": limit,
                "offset": offset,
            }
        except Exception as e:
            logger.warning(f"Query from cache failed for {table_name}: {e}")
            return None

    def get_all_tables(self) -> Dict[str, Any]:
        """
        Get list of all accessible real estate data tables.

        Returns:
            Dict with table names, row counts, and descriptions
        """
        try:
            # Only return whitelisted tables
            tables = sorted(list(self.ALLOWED_TABLES))

            # Get row count and basic info for each table
            table_info = {}
            for table in tables:
                try:
                    # Get row count
                    count_result = self.client.table(table).select('*', count='exact').limit(0).execute()
                    row_count = count_result.count if hasattr(count_result, 'count') else 'unknown'

                    # Get sample row to infer columns
                    sample = self.client.table(table).select('*').limit(1).execute()
                    columns = list(sample.data[0].keys()) if sample.data else []

                    table_info[table] = {
                        'row_count': row_count,
                        'columns': columns,
                        'column_count': len(columns)
                    }
                except Exception as e:
                    logger.warning(f"Could not get info for table {table}: {e}")
                    table_info[table] = {
                        'row_count': 'unknown',
                        'columns': [],
                        'column_count': 0
                    }

            return {
                'success': True,
                'total_tables': len(tables),
                'tables': table_info
            }

        except Exception as e:
            logger.error(f"Error getting tables: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def describe_table(self, table_name: str) -> Dict[str, Any]:
        """
        Get detailed schema information about a table.

        Args:
            table_name: Name of the table

        Returns:
            Dict with column names, types, and sample data
        """
        # Validate access
        if not self._validate_table_access(table_name):
            return {
                'success': False,
                'error': f'Access denied: Table {table_name} is not a real estate data table'
            }

        try:
            # Get sample data to infer structure
            result = self.client.table(table_name).select('*').limit(5).execute()

            if not result.data:
                return {
                    'success': False,
                    'error': f'Table {table_name} is empty or does not exist'
                }

            # Convert to DataFrame for analysis
            df = pd.DataFrame(result.data)

            # Get column info
            columns_info = []
            for col in df.columns:
                col_info = {
                    'name': col,
                    'type': str(df[col].dtype),
                    'null_count': int(df[col].isnull().sum()),
                    'unique_count': int(df[col].nunique()),
                    'sample_values': df[col].head(3).tolist()
                }

                # Add stats for numeric columns
                if df[col].dtype in ['int64', 'float64']:
                    col_info['min'] = float(df[col].min()) if not pd.isna(df[col].min()) else None
                    col_info['max'] = float(df[col].max()) if not pd.isna(df[col].max()) else None
                    col_info['mean'] = float(df[col].mean()) if not pd.isna(df[col].mean()) else None

                columns_info.append(col_info)

            # Get row count
            count_result = self.client.table(table_name).select('*', count='exact').limit(0).execute()
            row_count = count_result.count if hasattr(count_result, 'count') else len(result.data)

            return {
                'success': True,
                'table_name': table_name,
                'row_count': row_count,
                'column_count': len(columns_info),
                'columns': columns_info,
                'sample_data': result.data[:3]
            }

        except Exception as e:
            logger.error(f"Error describing table {table_name}: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def query_table(
        self,
        table_name: str,
        columns: Optional[List[str]] = None,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Query a table with filters.

        Args:
            table_name: Table to query
            columns: Columns to select (None = all)
            filters: Dict of column: value filters
            order_by: Column to sort by
            limit: Max rows to return
            offset: Number of rows to skip

        Returns:
            Dict with query results
        """
        # Validate access
        if not self._validate_table_access(table_name):
            return {
                'success': False,
                'error': f'Access denied: Table {table_name} is not a real estate data table'
            }

        # Use market data cache when available to avoid DB round-trip
        cached_result = self._query_table_from_cache(
            table_name, columns=columns, filters=filters,
            order_by=order_by, limit=limit, offset=offset
        )
        if cached_result is not None:
            return cached_result

        try:
            # Build query
            select_cols = ','.join(columns) if columns else '*'
            query = self.client.table(table_name).select(select_cols, count='exact')

            # Apply filters
            if filters:
                for col, value in filters.items():
                    if isinstance(value, list):
                        query = query.in_(col, value)
                    elif isinstance(value, dict):
                        # Support operators like {'gte': 100, 'lte': 200}
                        for op, val in value.items():
                            if op == 'gte':
                                query = query.gte(col, val)
                            elif op == 'lte':
                                query = query.lte(col, val)
                            elif op == 'gt':
                                query = query.gt(col, val)
                            elif op == 'lt':
                                query = query.lt(col, val)
                            elif op == 'eq':
                                query = query.eq(col, val)
                            elif op == 'neq':
                                query = query.neq(col, val)
                            elif op == 'like':
                                query = query.like(col, val)
                            elif op == 'ilike':
                                query = query.ilike(col, val)
                    else:
                        query = query.eq(col, value)

            # Order
            if order_by:
                desc = order_by.startswith('-')
                col = order_by.lstrip('-')
                query = query.order(col, desc=desc)

            # Limit and offset
            query = query.limit(limit).offset(offset)

            # Execute
            result = query.execute()

            return {
                'success': True,
                'table': table_name,
                'total_count': result.count if hasattr(result, 'count') else len(result.data),
                'returned_count': len(result.data),
                'data': result.data,
                'limit': limit,
                'offset': offset
            }

        except Exception as e:
            logger.error(f"Error querying table {table_name}: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def search_tables(
        self,
        search_term: str,
        tables: Optional[List[str]] = None,
        columns: Optional[List[str]] = None,
        limit_per_table: int = 10
    ) -> Dict[str, Any]:
        """
        Search across multiple tables for a term.

        Args:
            search_term: Text to search for
            tables: Tables to search (None = search common real estate tables)
            columns: Columns to search in (None = search text columns)
            limit_per_table: Max results per table

        Returns:
            Dict with search results from each table
        """
        if tables is None:
            # Default to common real estate tables
            tables = ['geographies', 'zillow_metro', 'realtor_metro', 'propertyiq_scores']

        # Filter to only allowed tables
        tables = [t for t in tables if self._validate_table_access(t)]

        if not tables:
            return {
                'success': False,
                'error': 'No accessible tables specified'
            }

        results = {}

        for table in tables:
            try:
                # Get table structure
                sample = self.client.table(table).select('*').limit(1).execute()
                if not sample.data:
                    continue

                # Find text columns to search
                search_columns = columns if columns else []
                if not search_columns:
                    for col in sample.data[0].keys():
                        if 'name' in col.lower() or 'title' in col.lower() or 'description' in col.lower():
                            search_columns.append(col)

                if not search_columns:
                    continue

                # Search each column
                table_results = []
                for col in search_columns:
                    try:
                        query_result = self.client.table(table).select('*').ilike(col, f'%{search_term}%').limit(limit_per_table).execute()
                        if query_result.data:
                            table_results.extend(query_result.data)
                    except Exception:
                        pass

                if table_results:
                    # Remove duplicates
                    seen = set()
                    unique_results = []
                    for item in table_results:
                        item_id = str(item)
                        if item_id not in seen:
                            seen.add(item_id)
                            unique_results.append(item)

                    results[table] = {
                        'count': len(unique_results),
                        'results': unique_results[:limit_per_table]
                    }

            except Exception as e:
                logger.warning(f"Error searching table {table}: {e}")

        return {
            'success': True,
            'search_term': search_term,
            'tables_searched': len(tables),
            'tables_with_results': len(results),
            'results': results
        }

    def aggregate_query(
        self,
        table_name: str,
        aggregations: List[Dict[str, str]],
        group_by: Optional[List[str]] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Run aggregation queries (COUNT, SUM, AVG, MIN, MAX).

        Args:
            table_name: Table to query
            aggregations: List of dicts like [{'function': 'avg', 'column': 'price', 'alias': 'avg_price'}]
            group_by: Columns to group by
            filters: Filters to apply
            limit: Max groups to return

        Returns:
            Dict with aggregated results
        """
        # Validate access
        if not self._validate_table_access(table_name):
            return {
                'success': False,
                'error': f'Access denied: Table {table_name} is not a real estate data table'
            }

        try:
            # Fetch data (Supabase client doesn't support complex aggregations directly)
            query = self.client.table(table_name).select('*')

            # Apply filters
            if filters:
                for col, value in filters.items():
                    if isinstance(value, list):
                        query = query.in_(col, value)
                    else:
                        query = query.eq(col, value)

            # Execute with reasonable limit
            query = query.limit(10000)  # Get enough data for aggregation
            result = query.execute()

            if not result.data:
                return {
                    'success': False,
                    'error': 'No data found'
                }

            # Convert to DataFrame for aggregation
            df = pd.DataFrame(result.data)

            # Apply aggregations
            if group_by:
                grouped = df.groupby(group_by)

                agg_dict = {}
                for agg in aggregations:
                    func = agg['function']
                    col = agg['column']
                    alias = agg.get('alias', f"{func}_{col}")

                    if func == 'count':
                        agg_dict[alias] = (col, 'count')
                    elif func == 'sum':
                        agg_dict[alias] = (col, 'sum')
                    elif func == 'avg' or func == 'mean':
                        agg_dict[alias] = (col, 'mean')
                    elif func == 'min':
                        agg_dict[alias] = (col, 'min')
                    elif func == 'max':
                        agg_dict[alias] = (col, 'max')

                result_df = grouped.agg(**agg_dict).reset_index()
            else:
                # Aggregate entire table
                result_dict = {}
                for agg in aggregations:
                    func = agg['function']
                    col = agg['column']
                    alias = agg.get('alias', f"{func}_{col}")

                    if func == 'count':
                        result_dict[alias] = len(df)
                    elif func == 'sum':
                        result_dict[alias] = df[col].sum()
                    elif func == 'avg' or func == 'mean':
                        result_dict[alias] = df[col].mean()
                    elif func == 'min':
                        result_dict[alias] = df[col].min()
                    elif func == 'max':
                        result_dict[alias] = df[col].max()

                result_df = pd.DataFrame([result_dict])

            # Limit results
            result_df = result_df.head(limit)

            # Convert to dict
            results = result_df.to_dict(orient='records')

            return {
                'success': True,
                'table': table_name,
                'group_by': group_by,
                'aggregations': aggregations,
                'result_count': len(results),
                'results': results
            }

        except Exception as e:
            logger.error(f"Error in aggregate query: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_data_summary(self) -> Dict[str, Any]:
        """
        Get high-level summary of all data in the database.

        Returns:
            Summary of data sources, record counts, date ranges, etc.
        """
        try:
            summary = {
                'zillow': {},
                'realtor': {},
                'census': {},
                'economic': {},
                'scores': {},
                'analytics': {},
                'other': {}
            }

            # Zillow data
            for geo in ['metro', 'county', 'zip', 'state']:
                try:
                    table = f'zillow_{geo}'
                    count = self.client.table(table).select('*', count='exact').limit(0).execute()
                    latest = self.client.table(table).select('period_date').order('period_date', desc=True).limit(1).execute()

                    summary['zillow'][geo] = {
                        'records': count.count if hasattr(count, 'count') else 0,
                        'latest_date': latest.data[0]['period_date'] if latest.data else None
                    }
                except Exception:
                    pass

            # Realtor data
            for geo in ['metro', 'county', 'zip']:
                try:
                    table = f'realtor_{geo}'
                    count = self.client.table(table).select('*', count='exact').limit(0).execute()
                    latest = self.client.table(table).select('period_date').order('period_date', desc=True).limit(1).execute()

                    summary['realtor'][geo] = {
                        'records': count.count if hasattr(count, 'count') else 0,
                        'latest_date': latest.data[0]['period_date'] if latest.data else None
                    }
                except Exception:
                    pass

            # Scores
            try:
                count = self.client.table('propertyiq_scores').select('*', count='exact').limit(0).execute()
                summary['scores']['current'] = {
                    'records': count.count if hasattr(count, 'count') else 0
                }

                count = self.client.table('propertyiq_scores_history').select('*', count='exact').limit(0).execute()
                summary['scores']['history'] = {
                    'records': count.count if hasattr(count, 'count') else 0
                }
            except Exception:
                pass

            # Analytics (conversations, saved queries, etc.)
            for table in ['analytics_conversations', 'analytics_saved_queries', 'analytics_watchlist']:
                try:
                    count = self.client.table(table).select('*', count='exact').limit(0).execute()
                    summary['analytics'][table.replace('analytics_', '')] = {
                        'records': count.count if hasattr(count, 'count') else 0
                    }
                except Exception:
                    pass

            return {
                'success': True,
                'summary': summary,
                'generated_at': pd.Timestamp.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Error getting data summary: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# Singleton
_db_query_service: Optional[DatabaseQueryService] = None

def get_database_query_service() -> DatabaseQueryService:
    """Get or create the database query service singleton."""
    global _db_query_service
    if _db_query_service is None:
        _db_query_service = DatabaseQueryService()
    return _db_query_service
