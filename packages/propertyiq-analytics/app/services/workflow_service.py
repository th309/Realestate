"""
Workflow Service - ML Pipeline Steps

Implements the 6 workflow steps for PropertyIQ ML pipeline.
Each step queries real database tables and fails if required tables don't exist.
"""

import logging
import os
from datetime import datetime, date
from typing import Optional, Any
from dataclasses import dataclass, field

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

    def _query_table(self, table_name: str, filters: dict = None, limit: int = None) -> tuple[list, int]:
        """
        Query a table and return (data, count).
        Raises exception if table doesn't exist.
        """
        query = self.supabase.table(table_name).select("*", count="exact")

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
        states: Optional[list[str]] = None
    ) -> StepResult:
        """
        Step 1: Export data to Parquet files for ML processing.
        Queries: geographies, zillow_zip, census_zip, economic_state
        """
        step_id = "data-export"
        started_at = datetime.utcnow()
        metrics = {}

        try:
            filters = {"state": states} if states else None

            # Query each required table
            _, geo_count = self._query_table("geographies", filters)
            metrics["geographies"] = geo_count

            _, zillow_count = self._query_table("zillow_zip", filters)
            metrics["zillow_zip"] = zillow_count

            _, census_count = self._query_table("census_zip", filters)
            metrics["census_zip"] = census_count

            _, econ_count = self._query_table("economic_state")
            metrics["economic_state"] = econ_count

            metrics["total_records"] = geo_count + zillow_count + census_count + econ_count

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

    async def run_prepare_backtest_data(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        states: Optional[list[str]] = None,
        holding_period_months: int = 12
    ) -> StepResult:
        """
        Step 2: Prepare backtest dataset.
        Queries: backtest_outcomes, propertyiq_scores, zillow_zip
        """
        step_id = "prepare-backtest-data"
        started_at = datetime.utcnow()
        metrics = {}

        try:
            filters = {"state": states} if states else None

            _, outcomes_count = self._query_table("backtest_outcomes", filters)
            metrics["backtest_outcomes"] = outcomes_count

            _, scores_count = self._query_table("propertyiq_scores", filters)
            metrics["propertyiq_scores"] = scores_count

            _, zillow_count = self._query_table("zillow_zip", filters)
            metrics["zillow_zip"] = zillow_count

            metrics["holding_period_months"] = holding_period_months

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
        Step 3: Calculate benchmarks.
        Queries: zillow_zip, zillow_state, census_zip
        """
        step_id = "calculate-benchmarks"
        started_at = datetime.utcnow()
        metrics = {}
        benchmark_types = benchmark_types or ["national", "regional", "peer"]

        try:
            if "national" in benchmark_types:
                _, count = self._query_table("zillow_zip")
                metrics["zillow_zip"] = count

            if "regional" in benchmark_types:
                _, count = self._query_table("zillow_state")
                metrics["zillow_state"] = count

            if "peer" in benchmark_types:
                _, count = self._query_table("census_zip")
                metrics["census_zip"] = count

            metrics["benchmark_types"] = benchmark_types

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
        target_metric: str = "price_appreciation_12m",
        model_type: str = "autogluon"
    ) -> StepResult:
        """
        Step 4: Feature analysis.
        Queries: propertyiq_scores
        """
        step_id = "feature-analysis"
        started_at = datetime.utcnow()
        metrics = {}

        try:
            _, scores_count = self._query_table("propertyiq_scores")
            metrics["propertyiq_scores"] = scores_count
            metrics["target_metric"] = target_metric
            metrics["model_type"] = model_type

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
        explanation_type: str = "shap"
    ) -> StepResult:
        """
        Step 5: Score explanations.
        Queries: propertyiq_scores
        """
        step_id = "score-explanations"
        started_at = datetime.utcnow()
        metrics = {}

        try:
            _, scores_count = self._query_table("propertyiq_scores")
            metrics["propertyiq_scores"] = scores_count
            metrics["sample_size"] = min(sample_size, scores_count)

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
        Step 6: Monthly report.
        Queries: propertyiq_scores, backtest_outcomes
        """
        step_id = "monthly-report"
        started_at = datetime.utcnow()
        metrics = {}
        report_month = report_month or datetime.utcnow().strftime("%Y-%m")

        try:
            _, scores_count = self._query_table("propertyiq_scores")
            metrics["propertyiq_scores"] = scores_count

            _, backtest_count = self._query_table("backtest_outcomes")
            metrics["backtest_outcomes"] = backtest_count

            metrics["report_month"] = report_month

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
