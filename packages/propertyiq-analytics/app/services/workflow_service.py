"""
Workflow Service - ML Pipeline Steps

Implements the workflow steps for PropertyIQ ML pipeline:
1. Data Export - Export scores/outcomes to analyze
2. Prepare Backtest Data - Join scores with forward outcomes
3. Calculate Benchmarks - Compute national/regional/peer averages
4. Feature Analysis - Find optimal formula weights
5. Score Explanations - Generate per-geography explanations
6. Monthly Report - Validation summary report

Uses DataCache for efficient access to full historical dataset.
"""

import logging
import os
from datetime import datetime, date
from typing import Optional, Any
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy import stats
from supabase import create_client, Client

from app.config import get_settings
from app.services.data_cache import get_data_cache, DataCache

logger = logging.getLogger(__name__)


@dataclass
class StepResult:
    """Result of a workflow step execution."""
    success: bool
    step_id: str
    started_at: datetime
    completed_at: datetime
    duration_seconds: float
    outputs: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    error_details: Optional[str] = None


class WorkflowService:
    """Service for executing ML workflow steps."""

    def __init__(self):
        self.settings = get_settings()
        self._supabase: Optional[Client] = None
        self._cache: Optional[DataCache] = None
        logger.info("WorkflowService initialized")

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

    @property
    def cache(self) -> DataCache:
        """Get data cache instance."""
        if self._cache is None:
            self._cache = get_data_cache()
        return self._cache

    def _safe_query(
        self,
        table_name: str,
        columns: str = "*",
        filters: dict = None,
        limit: int = 1000
    ) -> list:
        """Execute a safe query with limit to prevent timeouts."""
        try:
            query = self.supabase.table(table_name).select(columns)
            
            if filters:
                for key, value in filters.items():
                    if value is None:
                        continue
                    if isinstance(value, list):
                        query = query.in_(key, value)
                    else:
                        query = query.eq(key, value)
            
            query = query.limit(limit)
            response = query.execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Query error on {table_name}: {e}")
            return []

    def _get_sample_count(self, table_name: str, geo_type: str = None) -> int:
        """Get approximate count using a sample query (faster than exact count)."""
        try:
            # Build query step by step for supabase-py v2 compatibility
            query = self.supabase.table(table_name).select("id", count="exact")
            if geo_type:
                query = query.eq("geography_type", geo_type)
            query = query.limit(1)
            response = query.execute()
            return response.count or 0
        except Exception as e:
            logger.warning(f"Count query failed: {e}")
            return -1

    async def run_data_export(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        states: Optional[list[str]] = None,
        geography_types: Optional[list[str]] = None,
    ) -> StepResult:
        """
        Step 1: Export data for ML processing.
        
        Syncs all historical scores to the local cache for fast access.
        This enables full dataset analysis without repeated database queries.
        """
        step_id = "data-export"
        started_at = datetime.utcnow()
        metrics = {}
        outputs = []

        try:
            geography_types = geography_types or ["metro", "county", "zip", "state"]
            
            # Sync cache for each geography type
            logger.info("Syncing data cache for all geography types...")
            sync_results = {}
            
            for geo_type in geography_types:
                logger.info(f"Syncing cache for {geo_type}...")
                result = self.cache.sync_cache(geo_type, force_full=False)
                sync_results[geo_type] = result
                
                if result.get('success'):
                    outputs.append(f"{geo_type}: {result.get('total_records', 0)} records")
            
            metrics["sync_results"] = sync_results
            
            # Get overall cache status
            cache_status = self.cache.get_cache_status()
            metrics["cache_status"] = cache_status
            
            # Calculate totals
            total_records = sum(
                cache_status.get('caches', {}).get(geo, {}).get('record_count', 0)
                for geo in geography_types
            )
            metrics["total_records_cached"] = total_records
            
            metrics["status"] = "success"
            
            completed_at = datetime.utcnow()
            return StepResult(
                success=True,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                outputs=outputs,
                metrics=metrics
            )

        except Exception as e:
            completed_at = datetime.utcnow()
            logger.error(f"Data export failed: {e}")
            return StepResult(
                success=False,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                error=str(e),
                error_details=repr(e)
            )

    async def run_prepare_backtest_data(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        states: Optional[list[str]] = None,
        holding_period_months: int = 12
    ) -> StepResult:
        """
        Step 2: Prepare backtest dataset.
        
        Analyzes cached data to check completeness and quality.
        """
        step_id = "prepare-backtest-data"
        started_at = datetime.utcnow()
        metrics = {}

        try:
            # Check each geography type in cache
            geo_stats = {}
            total_records = 0
            
            for geo_type in ['metro', 'county', 'zip', 'state']:
                df = self.cache.get_cached_data(geo_type, auto_sync=False)
                
                if df is None or len(df) == 0:
                    geo_stats[geo_type] = {"status": "not_cached", "records": 0}
                    continue
                
                stats = {
                    "status": "ready",
                    "records": len(df),
                }
                
                # Check outcome availability
                for horizon in [12, 36, 60]:
                    col = f"actual_appreciation_{horizon}m"
                    if col in df.columns:
                        count = int(df[col].notna().sum())
                        pct = round(count / len(df) * 100, 1)
                        stats[f"with_outcome_{horizon}m"] = count
                        stats[f"pct_outcome_{horizon}m"] = pct
                
                # Check score availability
                for score in ['investoredge_score', 'homeready_score']:
                    if score in df.columns:
                        count = int(df[score].notna().sum())
                        pct = round(count / len(df) * 100, 1)
                        stats[f"with_{score}"] = count
                        stats[f"pct_{score}"] = pct
                
                geo_stats[geo_type] = stats
                total_records += len(df)
            
            metrics["geography_stats"] = geo_stats
            metrics["total_records"] = total_records
            metrics["status"] = "ready" if total_records > 0 else "no_data"
            
            completed_at = datetime.utcnow()
            return StepResult(
                success=True,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                metrics=metrics
            )

        except Exception as e:
            completed_at = datetime.utcnow()
            logger.error(f"Prepare backtest failed: {e}")
            return StepResult(
                success=False,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                error=str(e),
                error_details=repr(e)
            )

    async def run_calculate_benchmarks(
        self,
        benchmark_types: Optional[list[str]] = None
    ) -> StepResult:
        """
        Step 3: Calculate benchmarks from the data.
        
        Computes national/regional averages using the full cached dataset.
        """
        step_id = "calculate-benchmarks"
        started_at = datetime.utcnow()
        metrics = {}
        benchmark_types = benchmark_types or ["national", "regional", "peer"]

        try:
            # Combine data from all geography types
            all_dfs = []
            for geo_type in ['metro', 'county', 'zip', 'state']:
                df = self.cache.get_cached_data(geo_type, auto_sync=False)
                if df is not None and len(df) > 0:
                    all_dfs.append(df)
            
            if not all_dfs:
                metrics["error"] = "No cached data found. Run Data Export first."
                completed_at = datetime.utcnow()
                return StepResult(
                    success=False,
                    step_id=step_id,
                    started_at=started_at,
                    completed_at=completed_at,
                    duration_seconds=(completed_at - started_at).total_seconds(),
                    metrics=metrics,
                    error="No cached data found"
                )
            
            df = pd.concat(all_dfs, ignore_index=True)
            metrics["total_records_analyzed"] = len(df)
            
            # Calculate national benchmarks (across all data)
            if "national" in benchmark_types:
                national_benchmarks = {}
                for horizon in [12, 36, 60]:
                    col = f'actual_appreciation_{horizon}m'
                    if col in df.columns:
                        valid_data = df[col].dropna()
                        if len(valid_data) > 0:
                            national_benchmarks[f"{horizon}m"] = {
                                "mean": round(float(valid_data.mean()), 4),
                                "median": round(float(valid_data.median()), 4),
                                "std": round(float(valid_data.std()), 4),
                                "count": len(valid_data),
                            }
                metrics["national_benchmarks"] = national_benchmarks
            
            # Calculate by geography type
            if "regional" in benchmark_types and 'geography_type' in df.columns:
                geo_benchmarks = {}
                for geo_type in df['geography_type'].unique():
                    geo_df = df[df['geography_type'] == geo_type]
                    geo_stats = {}
                    for horizon in [12, 36]:
                        col = f'actual_appreciation_{horizon}m'
                        if col in geo_df.columns:
                            valid_data = geo_df[col].dropna()
                            if len(valid_data) > 0:
                                geo_stats[f"{horizon}m"] = {
                                    "mean": round(float(valid_data.mean()), 4),
                                    "count": len(valid_data),
                                }
                    geo_benchmarks[geo_type] = geo_stats
                metrics["geography_benchmarks"] = geo_benchmarks
            
            metrics["benchmark_types_calculated"] = benchmark_types
            metrics["status"] = "success"
            
            completed_at = datetime.utcnow()
            return StepResult(
                success=True,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                metrics=metrics
            )

        except Exception as e:
            completed_at = datetime.utcnow()
            logger.error(f"Calculate benchmarks failed: {e}")
            return StepResult(
                success=False,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                error=str(e),
                error_details=repr(e)
            )

    async def run_feature_analysis(
        self,
        target_metric: str = "actual_appreciation_12m",
        model_type: str = "correlation"
    ) -> StepResult:
        """
        Step 4: Analyze which features best predict outcomes.
        
        Uses correlation analysis on the full cached dataset.
        """
        step_id = "feature-analysis"
        started_at = datetime.utcnow()
        metrics = {}

        try:
            # Combine data from all geography types
            all_dfs = []
            for geo_type in ['metro', 'county', 'zip', 'state']:
                df = self.cache.get_cached_data(geo_type, auto_sync=False)
                if df is not None and len(df) > 0:
                    all_dfs.append(df)
            
            if not all_dfs:
                completed_at = datetime.utcnow()
                return StepResult(
                    success=False,
                    step_id=step_id,
                    started_at=started_at,
                    completed_at=completed_at,
                    duration_seconds=(completed_at - started_at).total_seconds(),
                    error="No cached data found. Run Data Export first."
                )
            
            df = pd.concat(all_dfs, ignore_index=True)
            metrics["total_records"] = len(df)
            
            # Correlation analysis by geography type
            score_cols = ['investoredge_score', 'homeready_score', 'market_health_score']
            outcome_cols = ['actual_appreciation_12m', 'actual_appreciation_36m', 'actual_appreciation_60m']
            
            # Overall correlations
            correlations = {}
            for score_col in score_cols:
                if score_col not in df.columns:
                    continue
                    
                for outcome_col in outcome_cols:
                    if outcome_col not in df.columns:
                        continue
                    
                    valid = df[[score_col, outcome_col]].dropna()
                    if len(valid) < 30:
                        continue
                    
                    r, p = stats.pearsonr(valid[score_col], valid[outcome_col])
                    rho, p_spearman = stats.spearmanr(valid[score_col], valid[outcome_col])
                    
                    key = f"{score_col}_vs_{outcome_col}"
                    correlations[key] = {
                        "pearson_r": round(float(r), 4),
                        "pearson_p": round(float(p), 4),
                        "spearman_rho": round(float(rho), 4),
                        "spearman_p": round(float(p_spearman), 4),
                        "r_squared": round(float(r ** 2), 4),
                        "n": len(valid),
                    }
            
            metrics["overall_correlations"] = correlations
            
            # Correlations by geography type
            geo_correlations = {}
            if 'geography_type' in df.columns:
                for geo_type in df['geography_type'].unique():
                    geo_df = df[df['geography_type'] == geo_type]
                    geo_corrs = {}
                    
                    for score_col in ['investoredge_score', 'homeready_score']:
                        if score_col not in geo_df.columns:
                            continue
                        
                        col = 'actual_appreciation_12m'
                        if col in geo_df.columns:
                            valid = geo_df[[score_col, col]].dropna()
                            if len(valid) >= 30:
                                r, p = stats.pearsonr(valid[score_col], valid[col])
                                geo_corrs[score_col] = {
                                    "pearson_r": round(float(r), 4),
                                    "n": len(valid),
                                }
                    
                    geo_correlations[geo_type] = geo_corrs
            
            metrics["correlations_by_geography"] = geo_correlations
            metrics["model_type"] = model_type
            metrics["target_metric"] = target_metric
            
            # Rank by correlation strength
            if correlations:
                ranked = sorted(
                    correlations.items(),
                    key=lambda x: abs(x[1]["pearson_r"]),
                    reverse=True
                )
                metrics["best_predictor"] = ranked[0][0] if ranked else None
                metrics["best_correlation"] = ranked[0][1] if ranked else None
            
            metrics["status"] = "success"
            
            completed_at = datetime.utcnow()
            return StepResult(
                success=True,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                metrics=metrics
            )

        except Exception as e:
            completed_at = datetime.utcnow()
            logger.error(f"Feature analysis failed: {e}")
            return StepResult(
                success=False,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                error=str(e),
                error_details=repr(e)
            )

    async def run_score_explanations(
        self,
        sample_size: int = 1000,
        explanation_type: str = "statistical"
    ) -> StepResult:
        """
        Step 5: Generate score explanations.
        
        Provides statistical breakdown of score distributions using full cached data.
        """
        step_id = "score-explanations"
        started_at = datetime.utcnow()
        metrics = {}

        try:
            # Combine data from all geography types
            all_dfs = []
            for geo_type in ['metro', 'county', 'zip', 'state']:
                df = self.cache.get_cached_data(geo_type, auto_sync=False)
                if df is not None and len(df) > 0:
                    all_dfs.append(df)
            
            if not all_dfs:
                completed_at = datetime.utcnow()
                return StepResult(
                    success=False,
                    step_id=step_id,
                    started_at=started_at,
                    completed_at=completed_at,
                    duration_seconds=(completed_at - started_at).total_seconds(),
                    error="No cached data found. Run Data Export first."
                )
            
            df = pd.concat(all_dfs, ignore_index=True)
            metrics["total_records"] = len(df)
            
            # Score distribution analysis - overall
            score_distributions = {}
            for score_col in ['investoredge_score', 'homeready_score']:
                if score_col in df.columns:
                    valid = df[score_col].dropna()
                    if len(valid) > 0:
                        score_distributions[score_col] = {
                            "count": len(valid),
                            "mean": round(float(valid.mean()), 2),
                            "std": round(float(valid.std()), 2),
                            "min": round(float(valid.min()), 2),
                            "max": round(float(valid.max()), 2),
                            "median": round(float(valid.median()), 2),
                            "percentiles": {
                                "10th": round(float(valid.quantile(0.1)), 2),
                                "25th": round(float(valid.quantile(0.25)), 2),
                                "75th": round(float(valid.quantile(0.75)), 2),
                                "90th": round(float(valid.quantile(0.9)), 2),
                            }
                        }
            
            metrics["score_distributions"] = score_distributions
            
            # Score distribution by geography type
            geo_distributions = {}
            if 'geography_type' in df.columns:
                for geo_type in df['geography_type'].unique():
                    geo_df = df[df['geography_type'] == geo_type]
                    geo_stats = {}
                    
                    for score_col in ['investoredge_score', 'homeready_score']:
                        if score_col in geo_df.columns:
                            valid = geo_df[score_col].dropna()
                            if len(valid) > 0:
                                geo_stats[score_col] = {
                                    "count": len(valid),
                                    "mean": round(float(valid.mean()), 2),
                                    "std": round(float(valid.std()), 2),
                                }
                    
                    geo_distributions[geo_type] = geo_stats
            
            metrics["distributions_by_geography"] = geo_distributions
            metrics["explanation_type"] = explanation_type
            metrics["status"] = "success"
            
            completed_at = datetime.utcnow()
            return StepResult(
                success=True,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                metrics=metrics
            )

        except Exception as e:
            completed_at = datetime.utcnow()
            logger.error(f"Score explanations failed: {e}")
            return StepResult(
                success=False,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                error=str(e),
                error_details=repr(e)
            )

    async def run_monthly_report(
        self,
        report_month: Optional[str] = None
    ) -> StepResult:
        """
        Step 6: Generate monthly validation report.
        
        Produces comprehensive backtest validation summary.
        """
        step_id = "monthly-report"
        started_at = datetime.utcnow()
        metrics = {}
        report_month = report_month or datetime.utcnow().strftime("%Y-%m")

        try:
            # Import backtest service for analysis
            from app.services.backtest_service import get_backtest_service
            
            backtest = get_backtest_service()
            
            # Run analysis for each score type
            score_types = ['investoredge', 'homeready']
            report_data = {}
            
            for score_type in score_types:
                try:
                    result = await backtest.run_full_backtest(
                        score_type=score_type,
                        geography_type="metro",
                        benchmark_type="national",
                        horizons=[12, 36, 60],
                    )
                    
                    report_data[score_type] = {
                        "validated": result.overall_validated,
                        "confidence_grade": result.confidence_grade,
                        "total_observations": result.total_observations,
                        "horizons": [
                            {
                                "months": h.horizon_months,
                                "spread": round(h.spread * 100, 2),
                                "top_excess": round(h.top_decile_excess * 100, 2),
                                "bottom_excess": round(h.bottom_decile_excess * 100, 2),
                                "r_squared": round(h.r_squared, 4),
                                "validated": h.validated,
                                "sample_size": h.sample_size,
                            }
                            for h in result.horizons
                        ] if result.horizons else []
                    }
                except Exception as e:
                    logger.error(f"Backtest for {score_type} failed: {e}")
                    report_data[score_type] = {"error": str(e)}
            
            metrics["report_month"] = report_month
            metrics["score_types_analyzed"] = score_types
            metrics["results"] = report_data
            
            # Summary
            all_validated = all(
                report_data.get(st, {}).get("validated", False)
                for st in score_types
            )
            metrics["all_scores_validated"] = all_validated
            metrics["status"] = "success"
            
            completed_at = datetime.utcnow()
            return StepResult(
                success=True,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                metrics=metrics
            )

        except Exception as e:
            completed_at = datetime.utcnow()
            logger.error(f"Monthly report failed: {e}")
            return StepResult(
                success=False,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                error=str(e),
                error_details=repr(e)
            )


_workflow_service: Optional[WorkflowService] = None


def get_workflow_service() -> WorkflowService:
    """Get or create workflow service singleton."""
    global _workflow_service
    if _workflow_service is None:
        _workflow_service = WorkflowService()
    return _workflow_service
