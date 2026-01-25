"""
Raw Metric Service

Queries raw data directly from Supabase for advanced ML analysis.
Handles Zillow (long format), Realtor (wide format), Census, and Economic data.
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import date, timedelta
import os

import pandas as pd
import numpy as np
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class RawMetricService:
    """Service for querying raw metrics from Supabase."""
    
    def __init__(self):
        self._client: Optional[Client] = None
        logger.info("RawMetricService initialized")
    
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
    
    def get_available_metrics(self, geography_type: str = 'metro') -> Dict[str, List[str]]:
        """
        Get list of available metrics by source.
        
        Returns dict with keys: zillow, realtor, census, economic, calculated
        """
        metrics = {
            'zillow': [],
            'realtor': [],
            'census': [],
            'economic': [],
            'calculated': []
        }
        
        try:
            # Get Zillow metric names (distinct from long-format table)
            zillow_table = f"zillow_{geography_type}"
            response = self.client.table(zillow_table).select("metric_name").limit(1000).execute()
            if response.data:
                metrics['zillow'] = sorted(list(set(r['metric_name'] for r in response.data if r.get('metric_name'))))
            
            # Realtor metrics are column names - return common ones
            metrics['realtor'] = [
                'median_listing_price', 'median_listing_price_yy',
                'median_days_on_market', 'median_days_on_market_yy',
                'active_listing_count', 'new_listing_count',
                'price_reduced_count', 'price_reduced_share',
                'pending_listing_count', 'pending_ratio',
                'hotness_score', 'supply_score', 'demand_score',
                'median_listing_price_per_square_foot'
            ]
            
            # Census metrics
            metrics['census'] = [
                'total_population', 'population_yoy',
                'median_household_income', 'income_yoy',
                'median_home_value', 'median_gross_rent',
                'homeownership_rate', 'rent_as_pct_of_income'
            ]
            
            # Economic metrics
            metrics['economic'] = [
                'unemployment_rate', 'unemployment_rate_yoy',
                'total_nonfarm_employment', 'employment_yoy',
                'gdp_millions', 'gdp_yoy'
            ]
            
            # Calculated metrics
            metrics['calculated'] = [
                'grm', 'rent_price_ratio', 'cap_rate_proxy',
                'price_rent_ratio', 'zhvi_yoy_change', 'zhvi_3y_change',
                'zhvi_5y_change', 'zhvi_90d_change', 'zori_90d_change',
                'zhvi_stddev_12m', 'months_of_supply', 'income_gap_ratio'
            ]
            
        except Exception as e:
            logger.warning(f"Error getting available metrics: {e}")
        
        return metrics
    
    def get_zillow_metrics(
        self,
        geography_type: str = 'metro',
        metrics: Optional[List[str]] = None,
        states: Optional[List[str]] = None,
        period_date: Optional[date] = None,
        limit: int = 5000
    ) -> pd.DataFrame:
        """
        Get Zillow metrics pivoted from long to wide format.
        
        Args:
            geography_type: metro, county, zip, state
            metrics: List of metric names to include (None = all)
            states: Filter by state codes
            period_date: Specific date (None = most recent)
            limit: Max records
        
        Returns:
            DataFrame with region_id, region_name, state_code, period_date, 
            and one column per metric
        """
        table_name = f"zillow_{geography_type}"
        
        try:
            # Build query
            query = self.client.table(table_name).select("*")
            
            # Filter by state
            if states:
                query = query.in_("state_code", [s.upper() for s in states])
            
            # Filter by metrics
            if metrics:
                query = query.in_("metric_name", metrics)
            
            # Filter by date or get most recent
            if period_date:
                query = query.eq("period_date", str(period_date))
            else:
                # Get most recent date first
                date_query = self.client.table(table_name).select("period_date").order("period_date", desc=True).limit(1).execute()
                if date_query.data:
                    latest_date = date_query.data[0]['period_date']
                    query = query.eq("period_date", latest_date)
            
            query = query.limit(limit)
            response = query.execute()
            
            if not response.data:
                return pd.DataFrame()
            
            # Convert to DataFrame and pivot
            df = pd.DataFrame(response.data)
            
            # Pivot from long to wide format
            if 'metric_name' in df.columns and 'value' in df.columns:
                id_cols = ['region_id', 'region_name', 'state_code', 'period_date']
                if geography_type == 'metro':
                    id_cols.append('cbsa_code')
                elif geography_type == 'county':
                    id_cols.append('fips_code')
                elif geography_type == 'zip':
                    id_cols.append('zip_code')
                
                id_cols = [c for c in id_cols if c in df.columns]
                
                df_pivot = df.pivot_table(
                    index=id_cols,
                    columns='metric_name',
                    values='value',
                    aggfunc='first'
                ).reset_index()
                
                return df_pivot
            
            return df
            
        except Exception as e:
            logger.error(f"Error fetching Zillow metrics: {e}")
            return pd.DataFrame()
    
    def get_realtor_metrics(
        self,
        geography_type: str = 'metro',
        metrics: Optional[List[str]] = None,
        states: Optional[List[str]] = None,
        period_date: Optional[date] = None,
        limit: int = 5000
    ) -> pd.DataFrame:
        """
        Get Realtor.com metrics (already in wide format).
        """
        table_name = f"realtor_{geography_type}"
        
        try:
            # Select specific columns if metrics specified
            if metrics:
                # Always include identifiers
                select_cols = "cbsa_code,cbsa_title,period_date," + ",".join(metrics)
            else:
                select_cols = "*"
            
            query = self.client.table(table_name).select(select_cols)
            
            # Note: Realtor tables may not have state_code directly
            # For metro, we'd need to join or filter differently
            
            # Filter by date
            if period_date:
                query = query.eq("period_date", str(period_date))
            else:
                query = query.order("period_date", desc=True)
            
            query = query.limit(limit)
            response = query.execute()
            
            if not response.data:
                return pd.DataFrame()
            
            return pd.DataFrame(response.data)
            
        except Exception as e:
            logger.error(f"Error fetching Realtor metrics: {e}")
            return pd.DataFrame()
    
    def get_census_metrics(
        self,
        geography_type: str = 'metro',
        states: Optional[List[str]] = None,
        year: Optional[int] = None,
        limit: int = 5000
    ) -> pd.DataFrame:
        """
        Get Census demographic data.
        """
        table_name = f"census_{geography_type}"
        
        try:
            query = self.client.table(table_name).select("*")
            
            if states and 'state_code' in ['metro', 'county']:
                # Census tables structure varies
                pass
            
            if year:
                query = query.eq("year", year)
            else:
                # Get most recent year
                query = query.order("year", desc=True)
            
            query = query.limit(limit)
            response = query.execute()
            
            if not response.data:
                return pd.DataFrame()
            
            return pd.DataFrame(response.data)
            
        except Exception as e:
            logger.error(f"Error fetching Census metrics: {e}")
            return pd.DataFrame()
    
    def get_economic_metrics(
        self,
        geography_type: str = 'metro',
        states: Optional[List[str]] = None,
        period_date: Optional[date] = None,
        limit: int = 5000
    ) -> pd.DataFrame:
        """
        Get Economic indicators (unemployment, employment, GDP).
        """
        table_name = f"economic_{geography_type}"
        
        try:
            query = self.client.table(table_name).select("*")
            
            if period_date:
                query = query.eq("period_date", str(period_date))
            else:
                query = query.order("period_date", desc=True)
            
            query = query.limit(limit)
            response = query.execute()
            
            if not response.data:
                return pd.DataFrame()
            
            return pd.DataFrame(response.data)
            
        except Exception as e:
            logger.error(f"Error fetching Economic metrics: {e}")
            return pd.DataFrame()
    
    def get_calculated_metrics(
        self,
        geography_type: str = 'metro',
        states: Optional[List[str]] = None,
        period_date: Optional[date] = None,
        limit: int = 5000
    ) -> pd.DataFrame:
        """
        Get calculated metrics (GRM, cap rate, ratios, etc.).
        """
        try:
            query = self.client.table("calculated_metrics").select("*")
            
            if geography_type:
                query = query.eq("geography_type", geography_type)
            
            if states:
                # Would need to join with geographies table
                pass
            
            if period_date:
                query = query.eq("period_date", str(period_date))
            else:
                query = query.order("period_date", desc=True)
            
            query = query.limit(limit)
            response = query.execute()
            
            if not response.data:
                return pd.DataFrame()
            
            return pd.DataFrame(response.data)
            
        except Exception as e:
            logger.error(f"Error fetching Calculated metrics: {e}")
            return pd.DataFrame()
    
    def get_unified_raw_data(
        self,
        geography_type: str = 'metro',
        states: Optional[List[str]] = None,
        include_zillow: bool = True,
        include_realtor: bool = True,
        include_census: bool = True,
        include_economic: bool = True,
        include_calculated: bool = True,
        period_date: Optional[date] = None,
        limit: int = 1000
    ) -> pd.DataFrame:
        """
        Get unified raw data from multiple sources, joined by geography.
        
        This is the main entry point for ML analysis of raw metrics.
        
        Args:
            geography_type: metro, county, zip, state
            states: Filter by state codes
            include_*: Which data sources to include
            period_date: Specific date (None = most recent)
            limit: Max records per source
        
        Returns:
            DataFrame with all requested metrics joined by geography
        """
        logger.info(f"Fetching unified raw data for {geography_type}")
        
        dfs = []
        
        # Get Zillow data
        if include_zillow:
            zillow_df = self.get_zillow_metrics(
                geography_type=geography_type,
                states=states,
                period_date=period_date,
                limit=limit
            )
            if len(zillow_df) > 0:
                # Add prefix to avoid column name conflicts
                metric_cols = [c for c in zillow_df.columns if c not in 
                              ['region_id', 'region_name', 'state_code', 'period_date', 'cbsa_code', 'fips_code', 'zip_code']]
                zillow_df = zillow_df.rename(columns={c: f'zillow_{c}' for c in metric_cols})
                dfs.append(('zillow', zillow_df))
                logger.info(f"Zillow: {len(zillow_df)} records, {len(metric_cols)} metrics")
        
        # Get Realtor data
        if include_realtor:
            realtor_df = self.get_realtor_metrics(
                geography_type=geography_type,
                states=states,
                period_date=period_date,
                limit=limit
            )
            if len(realtor_df) > 0:
                # Add prefix
                metric_cols = [c for c in realtor_df.columns if c not in 
                              ['cbsa_code', 'cbsa_title', 'period_date', 'id', 'created_at', 'updated_at', 'quality_flag']]
                realtor_df = realtor_df.rename(columns={c: f'realtor_{c}' for c in metric_cols})
                dfs.append(('realtor', realtor_df))
                logger.info(f"Realtor: {len(realtor_df)} records")
        
        # Get Census data
        if include_census:
            census_df = self.get_census_metrics(
                geography_type=geography_type,
                states=states,
                limit=limit
            )
            if len(census_df) > 0:
                metric_cols = [c for c in census_df.columns if c not in 
                              ['id', 'cbsa_code', 'year', 'created_at', 'updated_at']]
                census_df = census_df.rename(columns={c: f'census_{c}' for c in metric_cols})
                dfs.append(('census', census_df))
                logger.info(f"Census: {len(census_df)} records")
        
        # Get Economic data
        if include_economic:
            economic_df = self.get_economic_metrics(
                geography_type=geography_type,
                states=states,
                period_date=period_date,
                limit=limit
            )
            if len(economic_df) > 0:
                metric_cols = [c for c in economic_df.columns if c not in 
                              ['id', 'cbsa_code', 'period_date', 'created_at', 'updated_at']]
                economic_df = economic_df.rename(columns={c: f'econ_{c}' for c in metric_cols})
                dfs.append(('economic', economic_df))
                logger.info(f"Economic: {len(economic_df)} records")
        
        # Get Calculated metrics
        if include_calculated:
            calc_df = self.get_calculated_metrics(
                geography_type=geography_type,
                states=states,
                period_date=period_date,
                limit=limit
            )
            if len(calc_df) > 0:
                metric_cols = [c for c in calc_df.columns if c not in 
                              ['id', 'geography_id', 'geography_type', 'period_date', 'created_at', 'updated_at']]
                calc_df = calc_df.rename(columns={c: f'calc_{c}' for c in metric_cols})
                dfs.append(('calculated', calc_df))
                logger.info(f"Calculated: {len(calc_df)} records")
        
        if not dfs:
            logger.warning("No data retrieved from any source")
            return pd.DataFrame()
        
        # Start with the first dataframe
        source_name, result_df = dfs[0]
        logger.info(f"Starting merge with {source_name}")
        
        # Merge remaining dataframes
        for source_name, df in dfs[1:]:
            # Find common join key
            if geography_type == 'metro':
                join_key = 'cbsa_code'
            elif geography_type == 'county':
                join_key = 'fips_code' if 'fips_code' in df.columns else 'county_fips'
            elif geography_type == 'zip':
                join_key = 'zip_code'
            else:
                join_key = 'state_code'
            
            # Find the actual join key in both dataframes
            result_keys = [c for c in result_df.columns if join_key in c.lower() or c == join_key]
            df_keys = [c for c in df.columns if join_key in c.lower() or c == join_key]
            
            if result_keys and df_keys:
                result_df = result_df.merge(
                    df,
                    left_on=result_keys[0],
                    right_on=df_keys[0],
                    how='outer',
                    suffixes=('', f'_{source_name}')
                )
                logger.info(f"Merged {source_name}: {len(result_df)} records")
            else:
                logger.warning(f"Could not find join key for {source_name}")
        
        logger.info(f"Final unified data: {len(result_df)} records, {len(result_df.columns)} columns")
        return result_df
    
    def get_raw_metrics_for_regression(
        self,
        geography_type: str = 'metro',
        states: Optional[List[str]] = None,
        target_column: str = 'actual_appreciation_12m'
    ) -> pd.DataFrame:
        """
        Get raw metrics joined with outcomes for regression analysis.
        
        Combines raw metrics with PropertyIQ score history (which has outcomes).
        """
        # First get raw metrics
        raw_df = self.get_unified_raw_data(
            geography_type=geography_type,
            states=states,
            limit=2000
        )
        
        if len(raw_df) == 0:
            logger.warning("No raw metrics retrieved")
            return pd.DataFrame()
        
        # Get outcomes from scores_history
        try:
            outcome_cols = "geography_id,period_date,actual_appreciation_12m,actual_appreciation_36m,actual_appreciation_60m"
            query = self.client.table("propertyiq_scores_history").select(outcome_cols)
            
            if geography_type:
                query = query.eq("geography_type", geography_type)
            
            # Get most recent period with outcomes
            query = query.not_.is_("actual_appreciation_12m", "null")
            query = query.order("period_date", desc=True)
            query = query.limit(2000)
            
            response = query.execute()
            
            if response.data:
                outcomes_df = pd.DataFrame(response.data)
                
                # Get most recent outcome per geography
                outcomes_df = outcomes_df.sort_values('period_date', ascending=False)
                outcomes_df = outcomes_df.groupby('geography_id').first().reset_index()
                
                # Find join key in raw_df
                if geography_type == 'metro' and 'cbsa_code' in raw_df.columns:
                    # Try to join on cbsa_code = geography_id
                    merged = raw_df.merge(
                        outcomes_df,
                        left_on='cbsa_code',
                        right_on='geography_id',
                        how='inner'
                    )
                else:
                    # Try various join strategies
                    merged = raw_df.merge(
                        outcomes_df,
                        left_on='region_id' if 'region_id' in raw_df.columns else raw_df.columns[0],
                        right_on='geography_id',
                        how='inner'
                    )
                
                logger.info(f"Merged with outcomes: {len(merged)} records")
                return merged
                
        except Exception as e:
            logger.error(f"Error merging with outcomes: {e}")
        
        return raw_df


# Singleton
_raw_service: Optional[RawMetricService] = None

def get_raw_metric_service() -> RawMetricService:
    """Get or create the raw metric service singleton."""
    global _raw_service
    if _raw_service is None:
        _raw_service = RawMetricService()
    return _raw_service
