"""
Ad-hoc Analysis Service

Provides dynamic filtering and analysis of cached PropertyIQ data.
Supports natural language query execution via tool calls.
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import date
from dataclasses import dataclass, field

import pandas as pd
import numpy as np
from scipy import stats

from app.services.data_cache import get_data_cache, DataCache

logger = logging.getLogger(__name__)


def _native_scalar(x):
    """Convert numpy/pandas scalar to native Python for JSON serialization."""
    if x is None or (hasattr(pd, "isna") and pd.isna(x)):
        return None
    if hasattr(x, "item"):
        return x.item()
    if isinstance(x, (str, int, float, bool)):
        return x
    return str(x)


@dataclass
class FilterCriteria:
    """Criteria for filtering the dataset."""
    geography_type: Optional[str] = None
    states: Optional[List[str]] = None
    metros: Optional[List[str]] = None
    regions: Optional[List[str]] = None
    min_score: Optional[float] = None
    max_score: Optional[float] = None
    score_type: str = "investoredge_score"
    start_date: Optional[date] = None
    end_date: Optional[date] = None


@dataclass 
class AnalysisResult:
    """Result of an ad-hoc analysis."""
    success: bool
    query_description: str
    record_count: int
    geography_count: int
    summary_stats: Dict[str, Any] = field(default_factory=dict)
    top_performers: List[Dict] = field(default_factory=list)
    bottom_performers: List[Dict] = field(default_factory=list)
    correlations: Dict[str, Any] = field(default_factory=dict)
    benchmark_comparison: Dict[str, Any] = field(default_factory=dict)
    chart_data: Optional[Dict] = None
    error: Optional[str] = None


class AdhocAnalysisService:
    """Service for ad-hoc analysis queries."""
    
    def __init__(self):
        self._cache: Optional[DataCache] = None
        logger.info("AdhocAnalysisService initialized")
    
    @property
    def cache(self) -> DataCache:
        if self._cache is None:
            self._cache = get_data_cache()
        return self._cache
    
    def get_available_filters(self) -> Dict[str, Any]:
        """Return metadata about available filter options."""
        metro_df = self.cache.get_cached_data('metro', auto_sync=True)
        state_df = self.cache.get_cached_data('state', auto_sync=True)
        
        states = []
        if state_df is not None and 'geography_id' in state_df.columns:
            states = sorted(state_df['geography_id'].unique().tolist())
        
        metros_by_state = {}
        if metro_df is not None and 'parent_geography_id' in metro_df.columns:
            for state in metro_df['parent_geography_id'].dropna().unique():
                state_metros = metro_df[metro_df['parent_geography_id'] == state]
                if 'geography_id' in state_metros.columns and 'geography_name' in state_metros.columns:
                    metros_by_state[state] = state_metros[['geography_id', 'geography_name']].drop_duplicates().to_dict('records')
        
        # Get date range from data
        date_range = {"min": None, "max": None}
        if metro_df is not None and 'period_date' in metro_df.columns:
            date_range["min"] = str(metro_df['period_date'].min())
            date_range["max"] = str(metro_df['period_date'].max())
        
        return {
            "geography_types": ["state", "metro", "county", "zip"],
            "states": states,
            "state_count": len(states),
            "metros_by_state": metros_by_state,
            "regions": {
                "NE": "Northeast (CT, ME, MA, NH, RI, VT, NJ, NY, PA)",
                "MW": "Midwest (IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI)",
                "SO": "South (AL, AR, DE, DC, FL, GA, KY, LA, MD, MS, NC, OK, SC, TN, TX, VA, WV)",
                "WE": "West (AZ, CA, CO, ID, MT, NV, NM, OR, UT, WA, WY, AK, HI)"
            },
            "score_types": ["investoredge_score", "homeready_score", "market_health_score"],
            "horizons": [12, 24, 36, 60],
            "date_range": date_range,
        }
    
    def filter_data(self, criteria: FilterCriteria) -> pd.DataFrame:
        """Filter the cached dataset based on criteria."""
        geo_type = criteria.geography_type or 'metro'
        df = self.cache.get_cached_data(geo_type, auto_sync=True)
        
        if df is None or len(df) == 0:
            logger.warning(f"No cached data for {geo_type}")
            return pd.DataFrame()
        
        original_count = len(df)
        logger.info(f"Starting filter on {geo_type}: {original_count} records")
        
        # State filter
        if criteria.states:
            states_upper = [s.upper() for s in criteria.states]
            if 'parent_geography_id' in df.columns:
                df = df[df['parent_geography_id'].isin(states_upper)]
            elif 'geography_id' in df.columns and geo_type == 'state':
                df = df[df['geography_id'].isin(states_upper)]
            logger.info(f"After state filter ({criteria.states}): {len(df)} records")
        
        # Metro filter
        if criteria.metros:
            if 'geography_id' in df.columns:
                df = df[df['geography_id'].isin(criteria.metros)]
            logger.info(f"After metro filter: {len(df)} records")
        
        # Score range filter
        score_col = criteria.score_type
        if criteria.min_score is not None and score_col in df.columns:
            df = df[df[score_col] >= criteria.min_score]
            logger.info(f"After min_score filter (>={criteria.min_score}): {len(df)} records")
        if criteria.max_score is not None and score_col in df.columns:
            df = df[df[score_col] <= criteria.max_score]
            logger.info(f"After max_score filter (<={criteria.max_score}): {len(df)} records")
        
        # Date filter
        if 'period_date' in df.columns:
            if criteria.start_date:
                df = df[df['period_date'] >= str(criteria.start_date)]
            if criteria.end_date:
                df = df[df['period_date'] <= str(criteria.end_date)]
        
        logger.info(f"Filter complete: {original_count} -> {len(df)} records")
        return df
    
    def analyze_filtered_data(
        self,
        df: pd.DataFrame,
        score_type: str = "investoredge_score",
        horizons: List[int] = None,
        include_chart_data: bool = False
    ) -> AnalysisResult:
        """Run analysis on filtered dataset."""
        if horizons is None:
            horizons = [12, 36]
            
        if df is None or len(df) == 0:
            return AnalysisResult(
                success=False,
                query_description="No data matched filters",
                record_count=0,
                geography_count=0,
                error="No data available for analysis"
            )
        
        result = AnalysisResult(
            success=True,
            query_description=f"Analysis of {len(df)} records",
            record_count=int(len(df)),
            geography_count=int(df["geography_id"].nunique()) if "geography_id" in df.columns else 0,
        )
        
        # Summary statistics for score
        if score_type in df.columns:
            scores = df[score_type].dropna()
            if len(scores) > 0:
                result.summary_stats['score'] = {
                    'mean': round(float(scores.mean()), 2),
                    'median': round(float(scores.median()), 2),
                    'std': round(float(scores.std()), 2),
                    'min': round(float(scores.min()), 2),
                    'max': round(float(scores.max()), 2),
                    'count': len(scores),
                    'percentiles': {
                        '10th': round(float(scores.quantile(0.1)), 2),
                        '25th': round(float(scores.quantile(0.25)), 2),
                        '75th': round(float(scores.quantile(0.75)), 2),
                        '90th': round(float(scores.quantile(0.9)), 2),
                    }
                }
        
        # Correlations with outcomes
        for horizon in horizons:
            outcome_col = f'actual_appreciation_{horizon}m'
            if outcome_col in df.columns and score_type in df.columns:
                valid = df[[score_type, outcome_col]].dropna()
                if len(valid) >= 30:
                    try:
                        r, p = stats.pearsonr(valid[score_type], valid[outcome_col])
                        rho, p_spearman = stats.spearmanr(valid[score_type], valid[outcome_col])
                        result.correlations[f"{horizon}m"] = {
                            "pearson_r": round(float(r), 4),
                            "spearman_rho": round(float(rho), 4),
                            "r_squared": round(float(r**2), 4),
                            "p_value": round(float(p), 4),
                            "sample_size": len(valid),
                            "significant": bool(p < 0.05),
                        }
                    except Exception as e:
                        logger.warning(f"Correlation calculation failed for {horizon}m: {e}")
        
        # Top/bottom performers (most recent period per geography)
        if 'period_date' in df.columns and score_type in df.columns:
            try:
                latest = df.sort_values('period_date', ascending=False)
                latest_period = latest.groupby('geography_id').first().reset_index()
                sorted_df = latest_period.sort_values(score_type, ascending=False)
                
                def format_performer(row):
                    gid = row.get("geography_id")
                    gname = row.get("geography_name", gid)
                    perf = {
                        "geography_id": _native_scalar(gid),
                        "geography_name": _native_scalar(gname),
                        "score": round(float(row.get(score_type, 0)), 1) if pd.notna(row.get(score_type)) else None,
                    }
                    # Add appreciation if available
                    if "actual_appreciation_12m" in row and pd.notna(row.get("actual_appreciation_12m")):
                        perf["appreciation_12m"] = round(float(row["actual_appreciation_12m"]) * 100, 2)
                    if "actual_appreciation_36m" in row and pd.notna(row.get("actual_appreciation_36m")):
                        perf["appreciation_36m"] = round(float(row["actual_appreciation_36m"]) * 100, 2)
                    # Add state if available
                    if "parent_geography_id" in row and pd.notna(row.get("parent_geography_id")):
                        perf["state"] = _native_scalar(row["parent_geography_id"])
                    return perf
                
                result.top_performers = [format_performer(row) for _, row in sorted_df.head(10).iterrows()]
                result.bottom_performers = [format_performer(row) for _, row in sorted_df.tail(10).iterrows()]
            except Exception as e:
                logger.warning(f"Top/bottom performers calculation failed: {e}")
        
        # Chart data for visualization
        if include_chart_data and score_type in df.columns:
            try:
                scores = df[score_type].dropna()
                if len(scores) > 0:
                    hist, bin_edges = np.histogram(scores, bins=20)
                    result.chart_data = {
                        'distribution': {
                            'bins': [round(float(b), 1) for b in bin_edges],
                            'counts': [int(c) for c in hist]
                        }
                    }
            except Exception as e:
                logger.warning(f"Chart data generation failed: {e}")
        
        return result
    
    def compare_to_benchmark(
        self,
        filtered_df: pd.DataFrame,
        benchmark_type: str = "national",
        score_type: str = "investoredge_score"
    ) -> Dict[str, Any]:
        """Compare filtered data to a benchmark."""
        if filtered_df is None or len(filtered_df) == 0:
            return {"error": "No data to compare"}
        
        # Get benchmark data
        benchmark_df = None
        benchmark_name = "National"
        
        if benchmark_type == "national":
            all_dfs = []
            for geo_type in ['metro', 'county', 'state']:
                df = self.cache.get_cached_data(geo_type, auto_sync=False)
                if df is not None and len(df) > 0:
                    all_dfs.append(df)
            if all_dfs:
                benchmark_df = pd.concat(all_dfs, ignore_index=True)
        
        if benchmark_df is None or len(benchmark_df) == 0:
            return {"error": "No benchmark data available"}
        
        comparison = {
            "benchmark_name": benchmark_name,
            "benchmark_type": benchmark_type,
            "filtered_count": len(filtered_df),
            "benchmark_count": len(benchmark_df),
        }
        
        # Score comparison
        if score_type in filtered_df.columns and score_type in benchmark_df.columns:
            filtered_scores = filtered_df[score_type].dropna()
            benchmark_scores = benchmark_df[score_type].dropna()
            
            if len(filtered_scores) > 0 and len(benchmark_scores) > 0:
                filtered_mean = float(filtered_scores.mean())
                benchmark_mean = float(benchmark_scores.mean())
                benchmark_std = float(benchmark_scores.std())
                
                comparison['score'] = {
                    'filtered_mean': round(filtered_mean, 2),
                    'filtered_median': round(float(filtered_scores.median()), 2),
                    'benchmark_mean': round(benchmark_mean, 2),
                    'benchmark_median': round(float(benchmark_scores.median()), 2),
                    'difference': round(filtered_mean - benchmark_mean, 2),
                    'z_score': round((filtered_mean - benchmark_mean) / benchmark_std, 2) if benchmark_std > 0 else 0,
                    'percentile': round(float((benchmark_scores < filtered_mean).mean() * 100), 1)
                }
        
        # Appreciation comparison
        for horizon in [12, 36]:
            col = f'actual_appreciation_{horizon}m'
            if col in filtered_df.columns and col in benchmark_df.columns:
                filtered_values = filtered_df[col].dropna()
                benchmark_values = benchmark_df[col].dropna()
                
                if len(filtered_values) > 0 and len(benchmark_values) > 0:
                    filtered_mean = float(filtered_values.mean())
                    benchmark_mean = float(benchmark_values.mean())
                    
                    comparison[f'appreciation_{horizon}m'] = {
                        'filtered_mean_pct': round(filtered_mean * 100, 2),
                        'benchmark_mean_pct': round(benchmark_mean * 100, 2),
                        'excess_return_pct': round((filtered_mean - benchmark_mean) * 100, 2),
                        'filtered_sample': len(filtered_values),
                        'benchmark_sample': len(benchmark_values),
                    }
        
        return comparison
    
    def get_rankings(
        self,
        df: pd.DataFrame,
        score_type: str = "investoredge_score",
        limit: int = 10,
        ascending: bool = False
    ) -> Dict[str, Any]:
        """
        Get top or bottom performers from filtered data.

        PERFORMANCE TARGET: <100ms when df comes from cache (get_cached_data).
        Uses in-memory DataFrame only; no database round-trip.
        """
        if df is None or len(df) == 0:
            return {"error": "No data available", "rankings": []}
        
        if score_type not in df.columns:
            return {"error": f"Score type {score_type} not found", "rankings": []}
        
        # Get latest data per geography
        if 'period_date' in df.columns:
            latest = df.sort_values('period_date', ascending=False)
            latest_period = latest.groupby('geography_id').first().reset_index()
        else:
            latest_period = df.drop_duplicates(subset=['geography_id'])
        
        # Sort and get rankings
        sorted_df = latest_period.sort_values(score_type, ascending=ascending)
        rankings = []
        
        for rank, (_, row) in enumerate(sorted_df.head(limit).iterrows(), 1):
            gid = row.get("geography_id")
            gname = row.get("geography_name", gid)
            item = {
                "rank": rank,
                "geography_id": _native_scalar(gid),
                "geography_name": _native_scalar(gname),
                "score": round(float(row.get(score_type, 0)), 1) if pd.notna(row.get(score_type)) else None,
            }
            if "parent_geography_id" in row and pd.notna(row.get("parent_geography_id")):
                item["state"] = _native_scalar(row["parent_geography_id"])
            if "actual_appreciation_12m" in row and pd.notna(row.get("actual_appreciation_12m")):
                item["appreciation_12m"] = round(float(row["actual_appreciation_12m"]) * 100, 2)
            rankings.append(item)

        return {
            "total_geographies": int(latest_period["geography_id"].nunique()),
            "direction": "bottom" if ascending else "top",
            "limit": limit,
            "rankings": rankings,
        }
    
    def get_time_series(
        self,
        geography_id: str,
        geography_type: str,
        metrics: List[str] = None,
        months: int = 24
    ) -> Dict[str, Any]:
        """Get time series data for a specific geography."""
        if metrics is None:
            metrics = ['investoredge_score']
        
        df = self.cache.get_cached_data(geography_type, auto_sync=True)
        if df is None or len(df) == 0:
            return {"error": f"No data available for {geography_type}"}
        
        geo_df = df[df['geography_id'] == geography_id].copy()
        if len(geo_df) == 0:
            return {"error": f"No data for geography {geography_id}"}
        
        geo_df = geo_df.sort_values('period_date')
        if months > 0:
            geo_df = geo_df.tail(months)
        
        geography_name = (
            _native_scalar(geo_df["geography_name"].iloc[0])
            if "geography_name" in geo_df.columns
            else _native_scalar(geography_id)
        )

        series = {}
        for metric in metrics:
            if metric in geo_df.columns:
                metric_data = geo_df[['period_date', metric]].dropna()
                if len(metric_data) > 0:
                    series[metric] = {
                        'dates': metric_data['period_date'].astype(str).tolist(),
                        'values': [round(float(v), 4) for v in metric_data[metric].tolist()]
                    }
        
        return {
            'geography_id': geography_id,
            'geography_type': geography_type,
            'geography_name': geography_name,
            'months': months,
            'series': series
        }


# Singleton
_adhoc_service: Optional[AdhocAnalysisService] = None

def get_adhoc_service() -> AdhocAnalysisService:
    """Get or create the adhoc analysis service singleton."""
    global _adhoc_service
    if _adhoc_service is None:
        _adhoc_service = AdhocAnalysisService()
    return _adhoc_service
