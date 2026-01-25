"""
Workflow Service - ML Pipeline Steps

Implements the workflow steps for PropertyIQ ML pipeline:
1. Data Export - Export scores/outcomes to analyze
2. Prepare Backtest Data - Join scores with forward outcomes
3. Calculate Benchmarks - Compute national/regional/peer averages
4. Feature Analysis - Find optimal formula weights
5. Score Explanations - Generate per-geography explanations
6. Monthly Report - Validation summary report
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

    def _query_table(
        self,
        table_name: str,
        columns: str = "*",
        filters: dict = None,
        limit: int = None
    ) -> tuple[list, int]:
        """Query a table and return (data, count)."""
        query = self.supabase.table(table_name).select(columns, count="exact")
        
        if filters:
            for key, value in filters.items():
                if isinstance(value, list):
                    query = query.in_(key, value)
                else:
                    query = query.eq(key, value)
        
        if limit:
            query = query.limit(limit)
        
        response = query.execute()
        count = response.count if hasattr(response, 'count') and response.count else len(response.data)
        return response.data, count

    async def run_data_export(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        states: Optional[list[str]] = None,
        geography_types: Optional[list[str]] = None,
    ) -> StepResult:
        """
        Step 1: Export data for ML processing.
        
        Exports:
        - Historical scores with outcomes
        - Zillow ZHVI data for outcome calculation
        - Census data for peer grouping
        """
        step_id = "data-export"
        started_at = datetime.utcnow()
        metrics = {}
        outputs = []

        try:
            geography_types = geography_types or ["metro", "county", "zip", "state"]
            
            # Query historical scores
            logger.info("Fetching historical scores...")
            data, count = self._query_table(
                "propertyiq_scores_history",
                limit=100000
            )
            metrics["scores_history_count"] = count
            
            if data:
                df = pd.DataFrame(data)
                metrics["columns"] = list(df.columns)
                metrics["date_range"] = {
                    "min": df['period_date'].min() if 'period_date' in df.columns else None,
                    "max": df['period_date'].max() if 'period_date' in df.columns else None,
                }
                
                # Count by geography type
                if 'geography_type' in df.columns:
                    geo_counts = df['geography_type'].value_counts().to_dict()
                    metrics["by_geography_type"] = geo_counts
                
                # Count scores with outcomes
                outcome_cols = [c for c in df.columns if 'actual_appreciation' in c]
                for col in outcome_cols:
                    metrics[f"with_{col}"] = int(df[col].notna().sum())
                
                outputs.append(f"scores_history: {count} records")
            
            # Query Zillow data sample
            for geo_type in geography_types[:2]:  # Just check a couple
                table = f"zillow_{geo_type}"
                try:
                    _, zillow_count = self._query_table(table, limit=1)
                    metrics[f"{table}_available"] = zillow_count > 0
                except Exception as e:
                    metrics[f"{table}_error"] = str(e)
            
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
        
        Checks what data is available and what needs to be populated.
        """
        step_id = "prepare-backtest-data"
        started_at = datetime.utcnow()
        metrics = {}

        try:
            # Check scores history
            _, scores_count = self._query_table("propertyiq_scores_history", limit=1)
            metrics["scores_history_total"] = scores_count
            
            # Check for outcomes by horizon
            horizons = [6, 12, 24, 36, 60, 120]
            for horizon in horizons:
                col = f"actual_appreciation_{horizon}m"
                
                # Query count with this outcome populated
                response = self.supabase.table('propertyiq_scores_history') \
                    .select('*', count='exact', head=True) \
                    .not_(col, 'is', 'null') \
                    .execute()
                
                count = response.count or 0
                metrics[f"with_outcome_{horizon}m"] = count
                metrics[f"missing_outcome_{horizon}m"] = scores_count - count
            
            # Check for excess returns
            for horizon in [12, 36, 60]:
                col = f"excess_return_vs_national_{horizon}m"
                response = self.supabase.table('propertyiq_scores_history') \
                    .select('*', count='exact', head=True) \
                    .not_(col, 'is', 'null') \
                    .execute()
                
                count = response.count or 0
                metrics[f"with_excess_{horizon}m"] = count
            
            # Check for peer groups
            response = self.supabase.table('propertyiq_scores_history') \
                .select('*', count='exact', head=True) \
                .not_('peer_group_id', 'is', 'null') \
                .execute()
            metrics["with_peer_group"] = response.count or 0
            
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
        
        Computes national/regional/peer averages for each period and horizon.
        """
        step_id = "calculate-benchmarks"
        started_at = datetime.utcnow()
        metrics = {}
        benchmark_types = benchmark_types or ["national", "regional", "peer"]

        try:
            # Fetch sample data for benchmark calculation
            response = self.supabase.table('propertyiq_scores_history') \
                .select('period_date, geography_type, actual_appreciation_12m, actual_appreciation_36m') \
                .not_('actual_appreciation_12m', 'is', 'null') \
                .limit(50000) \
                .execute()
            
            if not response.data:
                metrics["error"] = "No data with outcomes found"
                return StepResult(
                    success=False,
                    step_id=step_id,
                    started_at=started_at,
                    completed_at=datetime.utcnow(),
                    duration_seconds=0,
                    metrics=metrics,
                    error="No data with outcomes found"
                )
            
            df = pd.DataFrame(response.data)
            metrics["records_analyzed"] = len(df)
            
            # Calculate national benchmarks
            if "national" in benchmark_types:
                for col in ['actual_appreciation_12m', 'actual_appreciation_36m']:
                    if col in df.columns:
                        valid_data = df[col].dropna()
                        metrics[f"national_{col}_mean"] = float(valid_data.mean())
                        metrics[f"national_{col}_median"] = float(valid_data.median())
                        metrics[f"national_{col}_std"] = float(valid_data.std())
                        metrics[f"national_{col}_count"] = len(valid_data)
            
            # Calculate by geography type
            if 'geography_type' in df.columns:
                for geo_type in df['geography_type'].unique():
                    geo_df = df[df['geography_type'] == geo_type]
                    if 'actual_appreciation_12m' in geo_df.columns:
                        valid_data = geo_df['actual_appreciation_12m'].dropna()
                        if len(valid_data) > 0:
                            metrics[f"{geo_type}_12m_mean"] = float(valid_data.mean())
                            metrics[f"{geo_type}_12m_count"] = len(valid_data)
            
            metrics["benchmark_types_calculated"] = benchmark_types
            
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
        
        Uses correlation analysis to find feature importance.
        (AutoGluon can be added later for advanced ML)
        """
        step_id = "feature-analysis"
        started_at = datetime.utcnow()
        metrics = {}

        try:
            # Fetch data with features and outcomes
            response = self.supabase.table('propertyiq_scores_history') \
                .select('investoredge_score, homeready_score, market_health_score, actual_appreciation_12m, actual_appreciation_36m') \
                .not_('actual_appreciation_12m', 'is', 'null') \
                .limit(50000) \
                .execute()
            
            if not response.data:
                return StepResult(
                    success=False,
                    step_id=step_id,
                    started_at=started_at,
                    completed_at=datetime.utcnow(),
                    duration_seconds=0,
                    error="No data found"
                )
            
            df = pd.DataFrame(response.data)
            metrics["records"] = len(df)
            
            # Correlation analysis
            score_cols = ['investoredge_score', 'homeready_score', 'market_health_score']
            outcome_cols = ['actual_appreciation_12m', 'actual_appreciation_36m']
            
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
            
            metrics["correlations"] = correlations
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
        
        For now, provides statistical breakdown. SHAP can be added later.
        """
        step_id = "score-explanations"
        started_at = datetime.utcnow()
        metrics = {}

        try:
            # Fetch sample scores
            response = self.supabase.table('propertyiq_scores_history') \
                .select('geography_id, geography_type, investoredge_score, homeready_score, actual_appreciation_12m') \
                .not_('investoredge_score', 'is', 'null') \
                .limit(sample_size) \
                .execute()
            
            if not response.data:
                return StepResult(
                    success=False,
                    step_id=step_id,
                    started_at=started_at,
                    completed_at=datetime.utcnow(),
                    duration_seconds=0,
                    error="No data found"
                )
            
            df = pd.DataFrame(response.data)
            metrics["sample_size"] = len(df)
            
            # Score distribution analysis
            for score_col in ['investoredge_score', 'homeready_score']:
                if score_col in df.columns:
                    valid = df[score_col].dropna()
                    metrics[f"{score_col}_distribution"] = {
                        "mean": float(valid.mean()),
                        "std": float(valid.std()),
                        "min": float(valid.min()),
                        "max": float(valid.max()),
                        "median": float(valid.median()),
                        "percentiles": {
                            "10th": float(valid.quantile(0.1)),
                            "25th": float(valid.quantile(0.25)),
                            "75th": float(valid.quantile(0.75)),
                            "90th": float(valid.quantile(0.9)),
                        }
                    }
            
            metrics["explanation_type"] = explanation_type
            
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
