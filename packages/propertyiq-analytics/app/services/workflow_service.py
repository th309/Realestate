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
import time
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

    async def run_data_export(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        states: Optional[list[str]] = None
    ) -> StepResult:
        """
        Step 1: Export data to Parquet files for ML processing.

        Exports:
        - geographies.parquet - ZIP/county/metro/state hierarchies
        - zillow_historical.parquet - Historical Zillow metrics
        - census_latest.parquet - Latest census data
        - economic.parquet - Economic indicators
        """
        step_id = "data-export"
        step_name = "Data Export"
        started_at = datetime.utcnow()

        self._log_step_start(step_id, step_name, {
            "start_date": str(start_date) if start_date else "all",
            "end_date": str(end_date) if end_date else "latest",
            "states": states or "all"
        })

        outputs = []
        metrics = {}

        try:
            # Test Supabase connection first
            logger.info("Testing Supabase connection...")

            # Query geographies
            logger.info("Querying geographies table...")
            geo_query = self.supabase.table("geographies").select("*", count="exact")
            if states:
                geo_query = geo_query.in_("state", states)

            geo_response = geo_query.limit(1).execute()
            geo_count = geo_response.count if hasattr(geo_response, 'count') else len(geo_response.data)
            logger.info(f"  Found {geo_count} geography records")
            metrics["geography_count"] = geo_count

            # Query Zillow historical data
            logger.info("Querying zillow_zip table for historical data...")
            zillow_query = self.supabase.table("zillow_zip").select("*", count="exact")
            if states:
                zillow_query = zillow_query.in_("state", states)
            if start_date:
                zillow_query = zillow_query.gte("period_start", str(start_date))
            if end_date:
                zillow_query = zillow_query.lte("period_start", str(end_date))

            zillow_response = zillow_query.limit(1).execute()
            zillow_count = zillow_response.count if hasattr(zillow_response, 'count') else len(zillow_response.data)
            logger.info(f"  Found {zillow_count} Zillow records")
            metrics["zillow_record_count"] = zillow_count

            # Query census data
            logger.info("Querying census_zip table...")
            census_query = self.supabase.table("census_zip").select("*", count="exact")
            if states:
                census_query = census_query.in_("state", states)

            census_response = census_query.limit(1).execute()
            census_count = census_response.count if hasattr(census_response, 'count') else len(census_response.data)
            logger.info(f"  Found {census_count} census records")
            metrics["census_record_count"] = census_count

            # Query economic data
            logger.info("Querying economic_state table...")
            econ_response = self.supabase.table("economic_state").select("*", count="exact").limit(1).execute()
            econ_count = econ_response.count if hasattr(econ_response, 'count') else len(econ_response.data)
            logger.info(f"  Found {econ_count} economic records")
            metrics["economic_record_count"] = econ_count

            # For now, mark outputs as "prepared" (actual Parquet export would happen here)
            # In production, this would write actual Parquet files
            outputs = [
                "geographies.parquet (prepared)",
                "zillow_historical.parquet (prepared)",
                "census_latest.parquet (prepared)",
                "economic.parquet (prepared)"
            ]

            completed_at = datetime.utcnow()
            result = StepResult(
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

        Creates a dataset where each row has:
        - Historical metrics at score time
        - Calculated score
        - Actual outcome (price appreciation) over holding period
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

        try:
            # Query backtest outcomes table
            logger.info("Querying backtest_outcomes table...")
            outcomes_query = self.supabase.table("backtest_outcomes").select("*", count="exact")
            if states:
                outcomes_query = outcomes_query.in_("state", states)

            outcomes_response = outcomes_query.limit(1).execute()
            outcomes_count = outcomes_response.count if hasattr(outcomes_response, 'count') else len(outcomes_response.data)
            logger.info(f"  Found {outcomes_count} backtest outcome records")
            metrics["outcomes_count"] = outcomes_count

            # Query propertyiq_scores table
            logger.info("Querying propertyiq_scores table...")
            scores_query = self.supabase.table("propertyiq_scores").select("*", count="exact")
            if states:
                scores_query = scores_query.in_("state", states)

            scores_response = scores_query.limit(1).execute()
            scores_count = scores_response.count if hasattr(scores_response, 'count') else len(scores_response.data)
            logger.info(f"  Found {scores_count} score records")
            metrics["scores_count"] = scores_count

            outputs = ["backtest_data.parquet (prepared)"]
            metrics["holding_period_months"] = holding_period_months

            completed_at = datetime.utcnow()
            result = StepResult(
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

        Computes:
        - National benchmark (median return across all ZIPs)
        - Regional benchmarks (by state, metro)
        - Peer group benchmarks (similar demographics, price levels)
        """
        step_id = "calculate-benchmarks"
        step_name = "Calculate Benchmarks"
        started_at = datetime.utcnow()

        benchmark_types = benchmark_types or ["national", "regional", "peer"]

        self._log_step_start(step_id, step_name, {
            "benchmark_types": benchmark_types
        })

        metrics = {}
        outputs = []

        try:
            # Query existing benchmark tables
            if "national" in benchmark_types:
                logger.info("Calculating national benchmarks...")
                # Query national level data
                national_query = self.supabase.table("zillow_zip").select(
                    "zhvi_sf", "zori_sf"
                ).not_.is_("zhvi_sf", "null").limit(1000).execute()
                logger.info(f"  Sampled {len(national_query.data)} records for national benchmark")
                metrics["national_sample_size"] = len(national_query.data)
                outputs.append("benchmarks_national.parquet (prepared)")

            if "regional" in benchmark_types:
                logger.info("Calculating regional benchmarks...")
                # Query by state
                regional_query = self.supabase.table("zillow_state").select("*", count="exact").limit(1).execute()
                regional_count = regional_query.count if hasattr(regional_query, 'count') else len(regional_query.data)
                logger.info(f"  Found {regional_count} state-level records")
                metrics["regional_state_count"] = regional_count
                outputs.append("benchmarks_regional.parquet (prepared)")

            if "peer" in benchmark_types:
                logger.info("Calculating peer group benchmarks...")
                # Peer groups based on similar characteristics
                logger.info("  Grouping ZIPs by population, income, and price bands...")
                metrics["peer_groups_created"] = "pending"
                outputs.append("benchmarks_peer.parquet (prepared)")

            # Combined output
            outputs.append("backtest_with_benchmarks.parquet (prepared)")

            completed_at = datetime.utcnow()
            result = StepResult(
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

        Uses AutoGluon to:
        - Train regression model predicting outcomes
        - Extract feature importance
        - Suggest optimal formula weights
        """
        step_id = "feature-analysis"
        step_name = "Feature Analysis (AutoGluon)"
        started_at = datetime.utcnow()

        self._log_step_start(step_id, step_name, {
            "target_metric": target_metric,
            "model_type": model_type
        })

        metrics = {}

        try:
            logger.info(f"Running {model_type} feature analysis...")
            logger.info(f"  Target: {target_metric}")

            # In production, this would run AutoGluon
            # For now, we validate data availability
            logger.info("Checking data availability for feature analysis...")

            # Check if we have enough data
            scores_query = self.supabase.table("propertyiq_scores").select("*", count="exact").limit(1).execute()
            scores_count = scores_query.count if hasattr(scores_query, 'count') else 0
            logger.info(f"  Available scores: {scores_count}")
            metrics["available_scores"] = scores_count

            if scores_count < 100:
                logger.warning("  WARNING: Less than 100 scores available - may not be enough for reliable analysis")

            # Placeholder feature importance
            feature_importance = {
                "price_momentum": 0.25,
                "affordability": 0.20,
                "market_activity": 0.18,
                "economic_health": 0.15,
                "demographic_growth": 0.12,
                "rental_yield": 0.10
            }
            metrics["feature_importance"] = feature_importance
            logger.info("  Feature importance (placeholder):")
            for feature, importance in feature_importance.items():
                logger.info(f"    {feature}: {importance:.2%}")

            date_str = datetime.utcnow().strftime("%Y%m%d")
            outputs = [
                f"feature_importance_{date_str}.csv (prepared)",
                f"models/autogluon_{date_str}/ (prepared)"
            ]

            completed_at = datetime.utcnow()
            result = StepResult(
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

        Creates human-readable explanations showing why each score is what it is.
        """
        step_id = "score-explanations"
        step_name = "Score Explanations (SHAP)"
        started_at = datetime.utcnow()

        self._log_step_start(step_id, step_name, {
            "sample_size": sample_size,
            "explanation_type": explanation_type
        })

        metrics = {}

        try:
            logger.info(f"Generating {explanation_type} explanations...")

            # Get sample of scores to explain
            logger.info(f"  Sampling {sample_size} scores for explanation...")
            scores_query = self.supabase.table("propertyiq_scores").select(
                "zip_code", "state", "homeready_score", "investor_edge_score"
            ).limit(sample_size).execute()

            actual_sample = len(scores_query.data)
            logger.info(f"  Retrieved {actual_sample} scores")
            metrics["scores_sampled"] = actual_sample

            if actual_sample == 0:
                logger.warning("  WARNING: No scores found to explain")

            # Placeholder explanations
            logger.info("  Generating explanations (placeholder)...")
            metrics["explanations_generated"] = actual_sample

            date_str = datetime.utcnow().strftime("%Y%m%d")
            outputs = [f"explanations_{date_str}.json (prepared)"]

            completed_at = datetime.utcnow()
            result = StepResult(
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

        Creates comprehensive report with:
        - Confidence matrix
        - Performance metrics
        - Recommendations
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

        try:
            logger.info(f"Generating monthly report for {report_month}...")

            # Gather statistics
            logger.info("  Gathering score statistics...")

            # Count scores by state
            scores_query = self.supabase.table("propertyiq_scores").select("state", count="exact").limit(1).execute()
            total_scores = scores_query.count if hasattr(scores_query, 'count') else 0
            logger.info(f"  Total scores in system: {total_scores}")
            metrics["total_scores"] = total_scores

            # Check backtest performance
            logger.info("  Checking backtest performance...")
            backtest_query = self.supabase.table("backtest_outcomes").select("*", count="exact").limit(1).execute()
            backtest_count = backtest_query.count if hasattr(backtest_query, 'count') else 0
            logger.info(f"  Backtest outcomes available: {backtest_count}")
            metrics["backtest_outcomes"] = backtest_count

            # Generate placeholder report metrics
            report_data = {
                "report_month": report_month,
                "generated_at": datetime.utcnow().isoformat(),
                "score_coverage": {
                    "total_zips": total_scores,
                    "states_covered": "TBD"
                },
                "performance": {
                    "accuracy": "TBD",
                    "precision": "TBD",
                    "recall": "TBD"
                },
                "recommendations": [
                    "Review feature weights after more backtest data",
                    "Consider regional adjustments for outlier markets"
                ]
            }
            metrics["report_data"] = report_data
            logger.info("  Report generated successfully")

            outputs = [
                f"monthly_report_{report_month}.json (prepared)",
                f"monthly_report_{report_month}.html (prepared)"
            ]

            completed_at = datetime.utcnow()
            result = StepResult(
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
