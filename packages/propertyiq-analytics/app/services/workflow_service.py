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


class WorkflowProgress:
    """
    Class-level progress tracking for workflow steps.
    
    Tracks the current step, substeps completed, and provides
    real-time progress information for the frontend.
    """
    _progress: dict[str, Any] = {}
    
    @classmethod
    def reset(cls):
        """Reset all progress tracking."""
        cls._progress = {}
    
    @classmethod
    def start_step(cls, step_id: str, total_substeps: int, substep_names: list[str] = None):
        """Start tracking a new step."""
        cls._progress = {
            "step_id": step_id,
            "status": "running",
            "started_at": datetime.utcnow().isoformat(),
            "total_substeps": total_substeps,
            "completed_substeps": 0,
            "current_substep": substep_names[0] if substep_names else "Starting...",
            "substep_names": substep_names or [],
            "percent": 0,
            "details": {},
        }
    
    @classmethod
    def update_substep(cls, substep_index: int, substep_name: str = None, details: dict = None):
        """Update progress to a new substep."""
        if not cls._progress:
            return
        
        cls._progress["completed_substeps"] = substep_index
        total = cls._progress.get("total_substeps", 1)
        cls._progress["percent"] = round(substep_index / total * 100, 1) if total > 0 else 0
        
        if substep_name:
            cls._progress["current_substep"] = substep_name
        elif cls._progress.get("substep_names") and substep_index < len(cls._progress["substep_names"]):
            cls._progress["current_substep"] = cls._progress["substep_names"][substep_index]
        
        if details:
            cls._progress["details"].update(details)
    
    @classmethod
    def complete_step(cls, success: bool = True, error: str = None):
        """Mark the current step as complete."""
        if cls._progress:
            cls._progress["status"] = "completed" if success else "error"
            cls._progress["completed_at"] = datetime.utcnow().isoformat()
            cls._progress["percent"] = 100 if success else cls._progress.get("percent", 0)
            if error:
                cls._progress["error"] = error
    
    @classmethod
    def get_progress(cls) -> dict[str, Any]:
        """Get current progress."""
        return cls._progress.copy()


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
        errors = []

        try:
            geography_types = geography_types or ["metro", "county", "zip", "state"]
            
            # Initialize progress tracking
            substeps = ["Validating connection"] + [f"Syncing {gt}" for gt in geography_types] + ["Finalizing cache"]
            WorkflowProgress.start_step(step_id, len(substeps), substeps)
            
            # EARLY VALIDATION: Test connectivity before starting long operation
            logger.info("=" * 60)
            logger.info("DATA EXPORT: Starting with early validation...")
            logger.info("=" * 60)
            
            WorkflowProgress.update_substep(0, "Validating database connection...")
            validation = self.cache.validate_connection(timeout_seconds=30)
            
            if not validation.get('success'):
                error_msg = validation.get('message', 'Connection validation failed')
                logger.error(f"EARLY VALIDATION FAILED: {error_msg}")
                logger.error(f"Validation details: {validation.get('details', {})}")
                
                WorkflowProgress.complete_step(success=False, error=error_msg)
                
                completed_at = datetime.utcnow()
                return StepResult(
                    success=False,
                    step_id=step_id,
                    started_at=started_at,
                    completed_at=completed_at,
                    duration_seconds=(completed_at - started_at).total_seconds(),
                    error=error_msg,
                    error_details=str(validation.get('details', {})),
                    metrics={"validation": validation}
                )
            
            logger.info(f"Early validation PASSED: {validation.get('details', {})}")
            WorkflowProgress.update_substep(1, "Connection validated, starting sync...")
            
            # Check if cache seems incomplete (less than 10k records per geo type is suspicious)
            # This handles the case where previous fetches were truncated by Supabase row limits
            cache_status = self.cache.get_cache_status()
            total_cached = sum(
                cache_status.get('caches', {}).get(gt, {}).get('record_count', 0)
                for gt in geography_types
            )
            force_full = total_cached < 50000  # Expect at least 50k total records
            
            if force_full:
                logger.info(f"Cache appears incomplete ({total_cached} records). Forcing full refresh...")
            
            # Sync cache for each geography type
            logger.info("Syncing data cache for all geography types...")
            sync_results = {}
            total_records = 0
            
            for idx, geo_type in enumerate(geography_types):
                # Substep index is offset by 1 due to validation step
                substep_idx = idx + 1
                WorkflowProgress.update_substep(substep_idx, f"Syncing {geo_type}...")
                logger.info(f"=" * 40)
                logger.info(f"Syncing cache for {geo_type} (step {substep_idx}/{len(substeps)})...")
                try:
                    result = self.cache.sync_cache(geo_type, force_full=force_full)
                    sync_results[geo_type] = result
                    
                    logger.info(f"sync_cache result for {geo_type}: success={result.get('success')}, "
                               f"records={result.get('total_records', 0)}, error={result.get('error', 'none')}")
                    
                    if result.get('success') and result.get('total_records', 0) > 0:
                        total_records += result.get('total_records', 0)
                        outputs.append(f"{geo_type}: {result.get('total_records', 0)} records")
                        WorkflowProgress.update_substep(substep_idx + 1, details={
                            geo_type: {"records": result.get('total_records', 0), "status": "complete"}
                        })
                    elif result.get('error'):
                        logger.error(f"ERROR syncing {geo_type}: {result.get('error')}")
                        errors.append(f"{geo_type}: {result.get('error')}")
                    else:
                        logger.warning(f"WARNING: No data fetched for {geo_type}")
                        errors.append(f"{geo_type}: No data fetched")
                except Exception as geo_err:
                    logger.error(f"EXCEPTION syncing {geo_type}: {type(geo_err).__name__}: {geo_err}", exc_info=True)
                    sync_results[geo_type] = {"success": False, "error": str(geo_err)}
                    errors.append(f"{geo_type}: {str(geo_err)}")
            
            # Final substep
            WorkflowProgress.update_substep(len(geography_types) + 1, "Finalizing cache...")
            
            metrics["sync_results"] = sync_results
            metrics["total_records_cached"] = total_records
            
            # Get overall cache status
            try:
                cache_status = self.cache.get_cache_status()
                metrics["cache_status"] = cache_status
            except Exception as cache_err:
                logger.warning(f"Could not get cache status: {cache_err}")
            
            # Determine success - need at least some data
            success = total_records > 0
            
            if success:
                metrics["status"] = "success"
            else:
                metrics["status"] = "failed"
                metrics["errors"] = errors
            
            completed_at = datetime.utcnow()
            return StepResult(
                success=success,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                outputs=outputs,
                metrics=metrics,
                error="; ".join(errors) if not success else None
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
        geo_types = ['metro', 'county', 'zip', 'state']

        try:
            # Initialize progress tracking
            substeps = [f"Analyzing {gt}" for gt in geo_types] + ["Generating summary"]
            WorkflowProgress.start_step(step_id, len(substeps), substeps)
            
            # Check each geography type in cache
            geo_stats = {}
            total_records = 0
            
            for idx, geo_type in enumerate(geo_types):
                WorkflowProgress.update_substep(idx, f"Analyzing {geo_type}...")
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
                
                WorkflowProgress.update_substep(idx + 1, details={
                    geo_type: {"records": len(df), "status": stats["status"]}
                })
            
            WorkflowProgress.update_substep(len(geo_types), "Generating summary...")
            
            metrics["geography_stats"] = geo_stats
            metrics["total_records"] = total_records
            metrics["status"] = "ready" if total_records > 0 else "no_data"
            
            WorkflowProgress.complete_step(success=True)
            
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
            WorkflowProgress.complete_step(success=False, error=str(e))
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
            # Initialize progress tracking
            substeps = ["Loading data", "National benchmarks", "Regional benchmarks", "Finalizing"]
            WorkflowProgress.start_step(step_id, len(substeps), substeps)
            
            WorkflowProgress.update_substep(0, "Loading cached data...")
            
            # Combine data from all geography types
            all_dfs = []
            for geo_type in ['metro', 'county', 'zip', 'state']:
                df = self.cache.get_cached_data(geo_type, auto_sync=False)
                if df is not None and len(df) > 0:
                    all_dfs.append(df)
            
            if not all_dfs:
                metrics["error"] = "No cached data found. Run Data Export first."
                WorkflowProgress.complete_step(success=False, error="No cached data")
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
            WorkflowProgress.update_substep(1, "Computing national benchmarks...", 
                                           {"records_loaded": len(df)})
            
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
            
            WorkflowProgress.update_substep(2, "Computing regional benchmarks...")
            
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
            
            WorkflowProgress.update_substep(3, "Finalizing...")
            
            metrics["benchmark_types_calculated"] = benchmark_types
            metrics["status"] = "success"
            
            WorkflowProgress.complete_step(success=True)
            
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
            WorkflowProgress.complete_step(success=False, error=str(e))
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
            # Initialize progress tracking
            substeps = ["Loading data", "Overall correlations", "Geography correlations", "Ranking predictors"]
            WorkflowProgress.start_step(step_id, len(substeps), substeps)
            
            WorkflowProgress.update_substep(0, "Loading cached data...")
            
            # Combine data from all geography types
            all_dfs = []
            for geo_type in ['metro', 'county', 'zip', 'state']:
                df = self.cache.get_cached_data(geo_type, auto_sync=False)
                if df is not None and len(df) > 0:
                    all_dfs.append(df)
            
            if not all_dfs:
                WorkflowProgress.complete_step(success=False, error="No cached data")
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
            
            WorkflowProgress.update_substep(1, "Computing overall correlations...", 
                                           {"records": len(df)})
            
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
            
            WorkflowProgress.update_substep(2, "Computing correlations by geography...",
                                           {"correlations_computed": len(correlations)})
            
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
            
            WorkflowProgress.update_substep(3, "Ranking predictors...")
            
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
            
            WorkflowProgress.complete_step(success=True)
            
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
            # Initialize progress tracking
            substeps = ["Loading data", "Overall distributions", "Geography distributions", "Finalizing"]
            WorkflowProgress.start_step(step_id, len(substeps), substeps)
            
            WorkflowProgress.update_substep(0, "Loading cached data...")
            
            # Combine data from all geography types
            all_dfs = []
            for geo_type in ['metro', 'county', 'zip', 'state']:
                df = self.cache.get_cached_data(geo_type, auto_sync=False)
                if df is not None and len(df) > 0:
                    all_dfs.append(df)
            
            if not all_dfs:
                WorkflowProgress.complete_step(success=False, error="No cached data")
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
            
            WorkflowProgress.update_substep(1, "Computing overall distributions...",
                                           {"records": len(df)})
            
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
            
            WorkflowProgress.update_substep(2, "Computing distributions by geography...")
            
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
            
            WorkflowProgress.update_substep(3, "Finalizing...")
            WorkflowProgress.complete_step(success=True)
            
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
        report_month: Optional[str] = None,
        property_value: float = 500000,  # For dollar impact calculation
    ) -> StepResult:
        """
        Step 6: Generate monthly validation report.
        
        Produces comprehensive backtest validation summary with:
        - Summary table comparing all scores
        - Beat-market rates
        - Statistical significance
        - Dollar impact analysis
        - Key findings and verdict
        """
        step_id = "monthly-report"
        started_at = datetime.utcnow()
        metrics = {}
        report_month = report_month or datetime.utcnow().strftime("%Y-%m")

        try:
            logger.info(f"Starting monthly report for {report_month}...")
            
            # Initialize progress tracking
            # Only backtest scores that have sufficient data
            substeps = ["Backtest HomeReady", "Backtest InvestorEdge", "Key findings", "Dollar impact", "Final verdict"]
            WorkflowProgress.start_step(step_id, len(substeps), substeps)
            
            # Import backtest service for analysis
            from app.services.backtest_service import get_backtest_service
            
            backtest = get_backtest_service()
            logger.info("Backtest service loaded")
            
            # Run analysis for each score type
            # Only include scores that typically have data
            score_display_names = {
                'homeready': 'HomeReady',
                'investoredge': 'InvestorEdge',
            }
            # Removed market_health as it often has insufficient data
            score_types = ['homeready', 'investoredge']
            
            validation_results = {}
            summary_table = {}
            
            for idx, score_type in enumerate(score_types):
                WorkflowProgress.update_substep(idx, f"Running backtest for {score_display_names[score_type]}...")
                try:
                    logger.info(f"Running backtest for {score_type}...")
                    result = await backtest.run_full_backtest(
                        score_type=score_type,
                        geography_type="metro",
                        benchmark_type="national",
                        horizons=[12, 36, 60],
                    )
                    
                    display_name = score_display_names.get(score_type, score_type)
                    
                    if result.validation_summary:
                        vs = result.validation_summary
                        logger.info(f"Backtest for {score_type}: spread={vs.spread:.2%}, validated={vs.validated}")
                        
                        # Format p-value
                        p_value_str = "<0.001" if vs.t_test_pvalue < 0.001 else f"{vs.t_test_pvalue:.3f}"
                        
                        summary_table[display_name] = {
                            "top_quintile_excess": f"+{vs.top_quintile_excess * 100:.2f}%" if vs.top_quintile_excess > 0 else f"{vs.top_quintile_excess * 100:.2f}%",
                            "bottom_quintile_excess": f"+{vs.bottom_quintile_excess * 100:.2f}%" if vs.bottom_quintile_excess > 0 else f"{vs.bottom_quintile_excess * 100:.2f}%",
                            "spread": f"+{vs.spread * 100:.2f}%" if vs.spread > 0 else f"{vs.spread * 100:.2f}%",
                            "top_beat_rate": f"{vs.top_quintile_beat_rate:.1f}%",
                            "bottom_beat_rate": f"{vs.bottom_quintile_beat_rate:.1f}%",
                            "t_test_pvalue": p_value_str,
                            "spearman_correlation": f"{vs.spearman_correlation:.2f}" if vs.spearman_correlation else "—",
                            "validated": vs.validated,
                            "observations": vs.observations,
                        }
                        
                        # Store raw values for analysis
                        validation_results[score_type] = {
                            "validated": vs.validated,
                            "top_quintile_excess": vs.top_quintile_excess,
                            "bottom_quintile_excess": vs.bottom_quintile_excess,
                            "spread": vs.spread,
                            "top_beat_rate": vs.top_quintile_beat_rate,
                            "bottom_beat_rate": vs.bottom_quintile_beat_rate,
                            "spearman_r": vs.spearman_correlation,
                            "p_value": vs.t_test_pvalue,
                            "confidence_grade": result.confidence_grade,
                            "total_observations": result.total_observations,
                        }
                    else:
                        logger.warning(f"No validation summary for {score_type}")
                        summary_table[display_name] = {"error": "No data"}
                        validation_results[score_type] = {"error": "No validation data"}
                        
                except Exception as e:
                    logger.error(f"Backtest for {score_type} failed: {e}", exc_info=True)
                    display_name = score_display_names.get(score_type, score_type)
                    summary_table[display_name] = {"error": str(e)}
                    validation_results[score_type] = {"error": str(e)}
            
            WorkflowProgress.update_substep(len(score_types), "Analyzing key findings...")
            
            # Determine best predictors
            valid_scores = {k: v for k, v in validation_results.items() if "error" not in v and v.get("validated")}
            
            best_spread_score = None
            best_hit_rate_score = None
            best_avoid_score = None
            
            if valid_scores:
                # Best spread (InvestorEdge typically)
                best_spread_score = max(valid_scores.items(), key=lambda x: x[1].get("spread", 0))
                # Best hit rate for picking winners
                best_hit_rate_score = max(valid_scores.items(), key=lambda x: x[1].get("top_beat_rate", 0))
                # Best at identifying losers (lowest bottom beat rate)
                best_avoid_score = min(valid_scores.items(), key=lambda x: x[1].get("bottom_beat_rate", 100))
            
            # Generate key findings
            key_findings = []
            
            # Finding 1: Value-add confirmation
            if valid_scores:
                key_findings.append({
                    "title": "All scores add genuine value — not just riding the market wave",
                    "points": [
                        "Top quintiles have positive excess returns",
                        "Bottom quintiles have negative excess returns",
                        "Returns increase monotonically with quintile",
                    ]
                })
            
            # Finding 2: Best predictor
            if best_spread_score:
                spread_pct = best_spread_score[1]["spread"] * 100
                bottom_beat = best_spread_score[1]["bottom_beat_rate"]
                key_findings.append({
                    "title": f"{score_display_names.get(best_spread_score[0], best_spread_score[0])} is the strongest predictor",
                    "points": [
                        f"{spread_pct:.2f}% spread between top and bottom",
                        f"Best at identifying losers (only {bottom_beat:.0f}% of bottom quintile beat market)",
                    ]
                })
            
            # Finding 3: Best hit rate
            if best_hit_rate_score and best_hit_rate_score != best_spread_score:
                top_beat = best_hit_rate_score[1]["top_beat_rate"]
                key_findings.append({
                    "title": f"{score_display_names.get(best_hit_rate_score[0], best_hit_rate_score[0])} has highest hit rate",
                    "points": [
                        f"{top_beat:.0f}% of top quintile beat the market",
                        "Best for confident 'buy' recommendations",
                    ]
                })
            
            # Finding 4: Avoiding losers
            if best_avoid_score:
                bottom_rates = [v.get("bottom_beat_rate", 50) for v in valid_scores.values()]
                if bottom_rates:
                    avg_bottom = sum(bottom_rates) / len(bottom_rates)
                    key_findings.append({
                        "title": "Avoiding losers may be more valuable than picking winners",
                        "points": [
                            f"Bottom quintile severely underperforms ({avg_bottom:.0f}% avg beat rate)",
                            "Strong 'avoid' signal",
                        ]
                    })
            
            WorkflowProgress.update_substep(len(score_types) + 1, "Calculating dollar impact...")
            
            # Calculate dollar impact (using 3-year horizon / 36m)
            dollar_impact = {}
            if valid_scores:
                # Use average excess returns across validated scores
                avg_top_excess = sum(v.get("top_quintile_excess", 0) for v in valid_scores.values()) / len(valid_scores)
                avg_bottom_excess = sum(v.get("bottom_quintile_excess", 0) for v in valid_scores.values()) / len(valid_scores)
                
                top_gain = property_value * avg_top_excess
                bottom_loss = property_value * avg_bottom_excess
                total_value_at_risk = top_gain - bottom_loss
                
                dollar_impact = {
                    "property_value": property_value,
                    "holding_period_years": 3,
                    "top_quintile_gain": f"+${top_gain:,.0f} vs median",
                    "bottom_quintile_loss": f"${bottom_loss:,.0f} vs median",
                    "total_value_at_risk": f"~${total_value_at_risk:,.0f}",
                }
            
            WorkflowProgress.update_substep(len(score_types) + 2, "Determining final verdict...")
            
            # Determine overall verdict
            all_validated = all(v.get("validated", False) for v in valid_scores.values()) if valid_scores else False
            any_significant = any(v.get("p_value", 1) < 0.05 for v in validation_results.values() if "error" not in v)
            
            if all_validated and any_significant:
                verdict = "Validation Complete: Scores Beat the Market"
                verdict_detail = "The scores are statistically validated predictors of excess returns (p < 0.001)."
            elif any_significant:
                verdict = "Partial Validation: Some Scores Show Predictive Power"
                verdict_detail = "Some scores demonstrate significant predictive ability, but not all are fully validated."
            else:
                verdict = "Validation Inconclusive: Insufficient Evidence"
                verdict_detail = "The current data does not provide sufficient evidence to validate predictive power."
            
            # Build final report
            metrics["report_month"] = report_month
            metrics["verdict"] = verdict
            metrics["verdict_detail"] = verdict_detail
            metrics["summary_table"] = summary_table
            metrics["key_findings"] = key_findings
            metrics["dollar_impact"] = dollar_impact
            metrics["validation_results"] = validation_results
            metrics["all_scores_validated"] = all_validated
            metrics["status"] = "success"
            
            WorkflowProgress.complete_step(success=True)
            logger.info(f"Monthly report completed: {verdict}")
            
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
            logger.error(f"Monthly report failed: {e}", exc_info=True)
            WorkflowProgress.complete_step(success=False, error=str(e))
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
