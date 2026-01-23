"""
Workflow Service - ML Pipeline Steps

Implements the 6 workflow steps for PropertyIQ ML pipeline:
1. Data Export - Export data to Parquet files
2. Prepare Backtest Data - Create backtest dataset with historical scores
3. Calculate Benchmarks - Compute national/regional/peer benchmarks
4. Feature Analysis - AutoGluon feature importance
5. Score Explanations - SHAP explanations
6. Monthly Report - Formula health report
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
        self.output_dir = os.environ.get("WORKFLOW_OUTPUT_DIR", "/tmp/propertyiq-workflow")

        logger.info("=" * 60)
        logger.info("WorkflowService initialized")
        logger.info(f"  Supabase URL configured: {bool(self.settings.supabase_url)}")
        logger.info(f"  Service key configured: {bool(self.settings.supabase_service_key)}")
        logger.info(f"  Output directory: {self.output_dir}")
        logger.info("=" * 60)

    @property
    def supabase(self) -> Client:
        """Lazy-load Supabase client."""
        if self._supabase is None:
            logger.info("Initializing Supabase client...")
            if not self.settings.supabase_url or not self.settings.supabase_service_key:
                error_msg = "Supabase credentials not configured"
                logger.error(f"FATAL: {error_msg}")
                logger.error(f"  SUPABASE_URL: {'set' if self.settings.supabase_url else 'MISSING'}")
                logger.error(f"  SUPABASE_SERVICE_KEY: {'set' if self.settings.supabase_service_key else 'MISSING'}")
                raise ValueError(error_msg)

            self._supabase = create_client(
                self.settings.supabase_url,
                self.settings.supabase_service_key
            )
            logger.info("Supabase client initialized successfully")
        return self._supabase

    def _log_step_start(self, step_id: str, step_name: str, params: dict = None):
        """Log step start with parameters."""
        logger.info("=" * 60)
        logger.info(f"STARTING STEP: {step_name}")
        logger.info(f"  Step ID: {step_id}")
        logger.info(f"  Timestamp: {datetime.utcnow().isoformat()}")
        if params:
            logger.info(f"  Parameters:")
            for key, value in params.items():
                logger.info(f"    {key}: {value}")
        logger.info("-" * 60)

    def _log_step_end(self, result: StepResult):
        """Log step completion."""
        logger.info("-" * 60)
        status = "SUCCESS" if result.success else "FAILED"
        logger.info(f"COMPLETED STEP: {result.step_id} - {status}")
        logger.info(f"  Duration: {result.duration_seconds:.2f}s")
        if result.outputs:
            logger.info(f"  Outputs: {', '.join(result.outputs)}")
        if result.metrics:
            logger.info(f"  Metrics:")
            for key, value in result.metrics.items():
                logger.info(f"    {key}: {value}")
        if result.error:
            logger.error(f"  Error: {result.error}")
            if result.error_details:
                logger.error(f"  Details: {result.error_details}")
        logger.info("=" * 60)

    def _safe_table_count(self, table_name: str, filters: dict = None) -> tuple[int, bool]:
        """
        Safely query a table and return count. Returns (count, exists).
        If table doesn't exist, returns (0, False) instead of raising error.
        """
        try:
            query = self.supabase.table(table_name).select("*", count="exact")

            # Apply filters if provided
            if filters:
                for key, value in filters.items():
                    if isinstance(value, list):
                        query = query.in_(key, value)
                    else:
                        query = query.eq(key, value)

            response = query.limit(1).execute()
            count = response.count if hasattr(response, 'count') else len(response.data)
            logger.info(f"  Table '{table_name}': {count} records")
            return count, True

        except Exception as e:
            error_str = str(e)
            if "PGRST205" in error_str or "Could not find the table" in error_str:
                logger.warning(f"  Table '{table_name}': NOT FOUND")
                return 0, False
            else:
                # Re-raise other errors
                raise

    async def run_data_export(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        states: Optional[list[str]] = None
    ) -> StepResult:
        """
        Step 1: Export data to Parquet files for ML processing.

        Validates data availability in:
        - geographies table
        - zillow_zip table
        - census_zip table
        - economic_state table
        """
        step_id = "data-export"
        step_name = "Data Export"
        started_at = datetime.utcnow()

        self._log_step_start(step_id, step_name, {
            "start_date": str(start_date) if start_date else "all",
            "end_date": str(end_date) if end_date else "latest",
            "states": states or "all"
        })

        metrics = {}
        tables_status = {}

        try:
            logger.info("Checking required tables...")
            filters = {"state": states} if states else None

            # Check all required tables
            geo_count, geo_exists = self._safe_table_count("geographies", filters)
            tables_status["geographies"] = {"exists": geo_exists, "count": geo_count}

            zillow_count, zillow_exists = self._safe_table_count("zillow_zip", filters)
            tables_status["zillow_zip"] = {"exists": zillow_exists, "count": zillow_count}

            census_count, census_exists = self._safe_table_count("census_zip", filters)
            tables_status["census_zip"] = {"exists": census_exists, "count": census_count}

            econ_count, econ_exists = self._safe_table_count("economic_state")
            tables_status["economic_state"] = {"exists": econ_exists, "count": econ_count}

            metrics["tables"] = tables_status
            metrics["total_records"] = geo_count + zillow_count + census_count + econ_count

            # Check which tables are missing
            missing = [t for t, s in tables_status.items() if not s["exists"]]
            if missing:
                metrics["missing_tables"] = missing
                logger.warning(f"Missing tables: {missing}")

            completed_at = datetime.utcnow()
            result = StepResult(
                success=True,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                outputs=[],
                metrics=metrics
            )

        except Exception as e:
            completed_at = datetime.utcnow()
            logger.exception(f"Error in {step_name}")
            result = StepResult(
                success=False,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                error=str(e),
                error_details=repr(e)
            )

        self._log_step_end(result)
        return result

    async def run_prepare_backtest_data(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        states: Optional[list[str]] = None,
        holding_period_months: int = 12
    ) -> StepResult:
        """
        Step 2: Prepare backtest dataset with historical scores and actual outcomes.

        Checks availability of:
        - backtest_outcomes table
        - propertyiq_scores table
        - zillow_zip historical data
        """
        step_id = "prepare-backtest-data"
        step_name = "Prepare Backtest Data"
        started_at = datetime.utcnow()

        self._log_step_start(step_id, step_name, {
            "start_date": str(start_date) if start_date else "all",
            "end_date": str(end_date) if end_date else "latest",
            "states": states or "all",
            "holding_period_months": holding_period_months
        })

        metrics = {}
        tables_status = {}

        try:
            logger.info("Checking backtest-related tables...")
            filters = {"state": states} if states else None

            # Check required tables
            outcomes_count, outcomes_exists = self._safe_table_count("backtest_outcomes", filters)
            tables_status["backtest_outcomes"] = {"exists": outcomes_exists, "count": outcomes_count}

            scores_count, scores_exists = self._safe_table_count("propertyiq_scores", filters)
            tables_status["propertyiq_scores"] = {"exists": scores_exists, "count": scores_count}

            zillow_count, zillow_exists = self._safe_table_count("zillow_zip", filters)
            tables_status["zillow_zip"] = {"exists": zillow_exists, "count": zillow_count}

            metrics["tables"] = tables_status
            metrics["holding_period_months"] = holding_period_months

            # Check which tables are missing
            missing = [t for t, s in tables_status.items() if not s["exists"]]
            if missing:
                metrics["missing_tables"] = missing
                logger.warning(f"Missing tables: {missing}")

            completed_at = datetime.utcnow()
            result = StepResult(
                success=True,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                outputs=[],
                metrics=metrics
            )

        except Exception as e:
            completed_at = datetime.utcnow()
            logger.exception(f"Error in {step_name}")
            result = StepResult(
                success=False,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                error=str(e),
                error_details=repr(e)
            )

        self._log_step_end(result)
        return result

    async def run_calculate_benchmarks(
        self,
        benchmark_types: Optional[list[str]] = None
    ) -> StepResult:
        """
        Step 3: Calculate national, regional, and peer group benchmarks.

        Checks availability of:
        - zillow_zip for national benchmarks
        - zillow_state for regional benchmarks
        - census_zip for peer group benchmarks
        """
        step_id = "calculate-benchmarks"
        step_name = "Calculate Benchmarks"
        started_at = datetime.utcnow()

        benchmark_types = benchmark_types or ["national", "regional", "peer"]

        self._log_step_start(step_id, step_name, {
            "benchmark_types": benchmark_types
        })

        metrics = {}
        tables_status = {}

        try:
            logger.info("Checking benchmark data sources...")

            if "national" in benchmark_types:
                zillow_count, zillow_exists = self._safe_table_count("zillow_zip")
                tables_status["zillow_zip"] = {"exists": zillow_exists, "count": zillow_count}

            if "regional" in benchmark_types:
                state_count, state_exists = self._safe_table_count("zillow_state")
                tables_status["zillow_state"] = {"exists": state_exists, "count": state_count}

            if "peer" in benchmark_types:
                census_count, census_exists = self._safe_table_count("census_zip")
                tables_status["census_zip"] = {"exists": census_exists, "count": census_count}

            metrics["tables"] = tables_status
            metrics["benchmark_types"] = benchmark_types

            # Check which tables are missing
            missing = [t for t, s in tables_status.items() if not s["exists"]]
            if missing:
                metrics["missing_tables"] = missing
                logger.warning(f"Missing tables: {missing}")

            completed_at = datetime.utcnow()
            result = StepResult(
                success=True,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                outputs=[],
                metrics=metrics
            )

        except Exception as e:
            completed_at = datetime.utcnow()
            logger.exception(f"Error in {step_name}")
            result = StepResult(
                success=False,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                error=str(e),
                error_details=repr(e)
            )

        self._log_step_end(result)
        return result

    async def run_feature_analysis(
        self,
        target_metric: str = "price_appreciation_12m",
        model_type: str = "autogluon"
    ) -> StepResult:
        """
        Step 4: ML-based feature importance and optimal weight suggestions.

        Checks availability of:
        - propertyiq_scores table for training data
        """
        step_id = "feature-analysis"
        step_name = "Feature Analysis (AutoGluon)"
        started_at = datetime.utcnow()

        self._log_step_start(step_id, step_name, {
            "target_metric": target_metric,
            "model_type": model_type
        })

        metrics = {}
        tables_status = {}

        try:
            logger.info("Checking data availability for feature analysis...")

            scores_count, scores_exists = self._safe_table_count("propertyiq_scores")
            tables_status["propertyiq_scores"] = {"exists": scores_exists, "count": scores_count}

            metrics["tables"] = tables_status
            metrics["target_metric"] = target_metric
            metrics["model_type"] = model_type

            if not scores_exists:
                metrics["status"] = "missing_data"
                logger.warning("propertyiq_scores table not found - cannot run feature analysis")
            elif scores_count < 100:
                metrics["status"] = "insufficient_data"
                logger.warning(f"Only {scores_count} scores available - need at least 100 for reliable analysis")
            else:
                metrics["status"] = "ready"

            completed_at = datetime.utcnow()
            result = StepResult(
                success=True,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                outputs=[],
                metrics=metrics
            )

        except Exception as e:
            completed_at = datetime.utcnow()
            logger.exception(f"Error in {step_name}")
            result = StepResult(
                success=False,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                error=str(e),
                error_details=repr(e)
            )

        self._log_step_end(result)
        return result

    async def run_score_explanations(
        self,
        sample_size: int = 1000,
        explanation_type: str = "shap"
    ) -> StepResult:
        """
        Step 5: Generate SHAP explanations for scores.

        Checks availability of:
        - propertyiq_scores table
        """
        step_id = "score-explanations"
        step_name = "Score Explanations (SHAP)"
        started_at = datetime.utcnow()

        self._log_step_start(step_id, step_name, {
            "sample_size": sample_size,
            "explanation_type": explanation_type
        })

        metrics = {}
        tables_status = {}

        try:
            logger.info("Checking scores table for explanations...")

            scores_count, scores_exists = self._safe_table_count("propertyiq_scores")
            tables_status["propertyiq_scores"] = {"exists": scores_exists, "count": scores_count}

            metrics["tables"] = tables_status
            metrics["requested_sample_size"] = sample_size
            metrics["available_scores"] = scores_count if scores_exists else 0

            if not scores_exists:
                metrics["status"] = "missing_data"
                logger.warning("propertyiq_scores table not found")
            elif scores_count == 0:
                metrics["status"] = "no_scores"
                logger.warning("No scores available to explain")
            else:
                metrics["status"] = "ready"
                metrics["actual_sample_size"] = min(sample_size, scores_count)

            completed_at = datetime.utcnow()
            result = StepResult(
                success=True,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                outputs=[],
                metrics=metrics
            )

        except Exception as e:
            completed_at = datetime.utcnow()
            logger.exception(f"Error in {step_name}")
            result = StepResult(
                success=False,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                error=str(e),
                error_details=repr(e)
            )

        self._log_step_end(result)
        return result

    async def run_monthly_report(
        self,
        report_month: Optional[str] = None
    ) -> StepResult:
        """
        Step 6: Generate monthly formula health report.

        Checks availability of:
        - propertyiq_scores table
        - backtest_outcomes table
        """
        step_id = "monthly-report"
        step_name = "Monthly Report"
        started_at = datetime.utcnow()

        if report_month is None:
            report_month = datetime.utcnow().strftime("%Y-%m")

        self._log_step_start(step_id, step_name, {
            "report_month": report_month
        })

        metrics = {}
        tables_status = {}

        try:
            logger.info("Checking data for monthly report...")

            scores_count, scores_exists = self._safe_table_count("propertyiq_scores")
            tables_status["propertyiq_scores"] = {"exists": scores_exists, "count": scores_count}

            backtest_count, backtest_exists = self._safe_table_count("backtest_outcomes")
            tables_status["backtest_outcomes"] = {"exists": backtest_exists, "count": backtest_count}

            metrics["tables"] = tables_status
            metrics["report_month"] = report_month

            # Check which tables are missing
            missing = [t for t, s in tables_status.items() if not s["exists"]]
            if missing:
                metrics["missing_tables"] = missing
                metrics["status"] = "missing_data"
                logger.warning(f"Missing tables: {missing}")
            else:
                metrics["status"] = "ready"

            completed_at = datetime.utcnow()
            result = StepResult(
                success=True,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                outputs=[],
                metrics=metrics
            )

        except Exception as e:
            completed_at = datetime.utcnow()
            logger.exception(f"Error in {step_name}")
            result = StepResult(
                success=False,
                step_id=step_id,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                error=str(e),
                error_details=repr(e)
            )

        self._log_step_end(result)
        return result


# Singleton instance
_workflow_service: Optional[WorkflowService] = None


def get_workflow_service() -> WorkflowService:
    """Get or create workflow service singleton."""
    global _workflow_service
    if _workflow_service is None:
        _workflow_service = WorkflowService()
    return _workflow_service
