"""
Workflow API Routes

Exposes the 6 ML workflow steps as API endpoints.
"""

import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.workflow_service import get_workflow_service, StepResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow", tags=["workflow"])


# Request/Response models

class DataExportRequest(BaseModel):
    """Request for data export step."""
    start_date: Optional[date] = Field(None, description="Start date for data export")
    end_date: Optional[date] = Field(None, description="End date for data export")
    states: Optional[list[str]] = Field(None, description="Filter by state codes")


class PrepareBacktestRequest(BaseModel):
    """Request for prepare backtest data step."""
    start_date: Optional[date] = Field(None, description="Start date for backtest data")
    end_date: Optional[date] = Field(None, description="End date for backtest data")
    states: Optional[list[str]] = Field(None, description="Filter by state codes")
    holding_period_months: int = Field(12, ge=1, le=60, description="Holding period in months")


class CalculateBenchmarksRequest(BaseModel):
    """Request for calculate benchmarks step."""
    benchmark_types: Optional[list[str]] = Field(
        None,
        description="Types of benchmarks: national, regional, peer"
    )


class FeatureAnalysisRequest(BaseModel):
    """Request for feature analysis step."""
    target_metric: str = Field("price_appreciation_12m", description="Target metric to predict")
    model_type: str = Field("autogluon", description="ML model type to use")


class ScoreExplanationsRequest(BaseModel):
    """Request for score explanations step."""
    sample_size: int = Field(1000, ge=1, le=100000, description="Number of scores to explain")
    explanation_type: str = Field("shap", description="Type of explanations: shap")


class MonthlyReportRequest(BaseModel):
    """Request for monthly report step."""
    report_month: Optional[str] = Field(None, description="Month for report (YYYY-MM)")


class WorkflowStepResponse(BaseModel):
    """Response from a workflow step."""
    success: bool
    step_id: str
    started_at: str
    completed_at: str
    duration_seconds: float
    outputs: list[str] = []
    metrics: dict = {}
    error: Optional[str] = None
    error_details: Optional[str] = None


def step_result_to_response(result: StepResult) -> WorkflowStepResponse:
    """Convert StepResult to API response."""
    return WorkflowStepResponse(
        success=result.success,
        step_id=result.step_id,
        started_at=result.started_at.isoformat(),
        completed_at=result.completed_at.isoformat(),
        duration_seconds=result.duration_seconds,
        outputs=result.outputs,
        metrics=result.metrics,
        error=result.error,
        error_details=result.error_details
    )


@router.post("/data-export", response_model=WorkflowStepResponse)
async def run_data_export(request: DataExportRequest = None):
    """
    Step 1: Export data to Parquet files for ML processing.

    Exports:
    - geographies.parquet
    - zillow_historical.parquet
    - census_latest.parquet
    - economic.parquet
    """
    logger.info("=" * 60)
    logger.info("API: POST /api/v1/workflow/data-export")
    logger.info(f"  Request: {request}")
    logger.info("=" * 60)

    try:
        service = get_workflow_service()
        request = request or DataExportRequest()

        result = await service.run_data_export(
            start_date=request.start_date,
            end_date=request.end_date,
            states=request.states
        )

        response = step_result_to_response(result)

        if not result.success:
            logger.error(f"API: data-export failed - {result.error}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": result.error,
                    "error_details": result.error_details,
                    "step_id": result.step_id
                }
            )

        logger.info(f"API: data-export completed successfully in {result.duration_seconds:.2f}s")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("API: Unexpected error in data-export")
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "error_details": repr(e),
                "step_id": "data-export"
            }
        )


@router.post("/prepare-backtest-data", response_model=WorkflowStepResponse)
async def run_prepare_backtest_data(request: PrepareBacktestRequest = None):
    """
    Step 2: Create backtest dataset with historical scores and actual outcomes.
    """
    logger.info("=" * 60)
    logger.info("API: POST /api/v1/workflow/prepare-backtest-data")
    logger.info(f"  Request: {request}")
    logger.info("=" * 60)

    try:
        service = get_workflow_service()
        request = request or PrepareBacktestRequest()

        result = await service.run_prepare_backtest_data(
            start_date=request.start_date,
            end_date=request.end_date,
            states=request.states,
            holding_period_months=request.holding_period_months
        )

        response = step_result_to_response(result)

        if not result.success:
            logger.error(f"API: prepare-backtest-data failed - {result.error}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": result.error,
                    "error_details": result.error_details,
                    "step_id": result.step_id
                }
            )

        logger.info(f"API: prepare-backtest-data completed in {result.duration_seconds:.2f}s")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("API: Unexpected error in prepare-backtest-data")
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "error_details": repr(e),
                "step_id": "prepare-backtest-data"
            }
        )


@router.post("/calculate-benchmarks", response_model=WorkflowStepResponse)
async def run_calculate_benchmarks(request: CalculateBenchmarksRequest = None):
    """
    Step 3: Compute national, regional, and peer group benchmarks.
    """
    logger.info("=" * 60)
    logger.info("API: POST /api/v1/workflow/calculate-benchmarks")
    logger.info(f"  Request: {request}")
    logger.info("=" * 60)

    try:
        service = get_workflow_service()
        request = request or CalculateBenchmarksRequest()

        result = await service.run_calculate_benchmarks(
            benchmark_types=request.benchmark_types
        )

        response = step_result_to_response(result)

        if not result.success:
            logger.error(f"API: calculate-benchmarks failed - {result.error}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": result.error,
                    "error_details": result.error_details,
                    "step_id": result.step_id
                }
            )

        logger.info(f"API: calculate-benchmarks completed in {result.duration_seconds:.2f}s")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("API: Unexpected error in calculate-benchmarks")
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "error_details": repr(e),
                "step_id": "calculate-benchmarks"
            }
        )


@router.post("/feature-analysis", response_model=WorkflowStepResponse)
async def run_feature_analysis(request: FeatureAnalysisRequest = None):
    """
    Step 4: ML-based feature importance and optimal weight suggestions.
    """
    logger.info("=" * 60)
    logger.info("API: POST /api/v1/workflow/feature-analysis")
    logger.info(f"  Request: {request}")
    logger.info("=" * 60)

    try:
        service = get_workflow_service()
        request = request or FeatureAnalysisRequest()

        result = await service.run_feature_analysis(
            target_metric=request.target_metric,
            model_type=request.model_type
        )

        response = step_result_to_response(result)

        if not result.success:
            logger.error(f"API: feature-analysis failed - {result.error}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": result.error,
                    "error_details": result.error_details,
                    "step_id": result.step_id
                }
            )

        logger.info(f"API: feature-analysis completed in {result.duration_seconds:.2f}s")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("API: Unexpected error in feature-analysis")
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "error_details": repr(e),
                "step_id": "feature-analysis"
            }
        )


@router.post("/score-explanations", response_model=WorkflowStepResponse)
async def run_score_explanations(request: ScoreExplanationsRequest = None):
    """
    Step 5: Generate SHAP explanations for scores.
    """
    logger.info("=" * 60)
    logger.info("API: POST /api/v1/workflow/score-explanations")
    logger.info(f"  Request: {request}")
    logger.info("=" * 60)

    try:
        service = get_workflow_service()
        request = request or ScoreExplanationsRequest()

        result = await service.run_score_explanations(
            sample_size=request.sample_size,
            explanation_type=request.explanation_type
        )

        response = step_result_to_response(result)

        if not result.success:
            logger.error(f"API: score-explanations failed - {result.error}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": result.error,
                    "error_details": result.error_details,
                    "step_id": result.step_id
                }
            )

        logger.info(f"API: score-explanations completed in {result.duration_seconds:.2f}s")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("API: Unexpected error in score-explanations")
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "error_details": repr(e),
                "step_id": "score-explanations"
            }
        )


@router.post("/monthly-report", response_model=WorkflowStepResponse)
async def run_monthly_report(request: MonthlyReportRequest = None):
    """
    Step 6: Generate monthly formula health report.
    """
    logger.info("=" * 60)
    logger.info("API: POST /api/v1/workflow/monthly-report")
    logger.info(f"  Request: {request}")
    logger.info("=" * 60)

    try:
        service = get_workflow_service()
        request = request or MonthlyReportRequest()

        result = await service.run_monthly_report(
            report_month=request.report_month
        )

        response = step_result_to_response(result)

        if not result.success:
            logger.error(f"API: monthly-report failed - {result.error}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": result.error,
                    "error_details": result.error_details,
                    "step_id": result.step_id
                }
            )

        logger.info(f"API: monthly-report completed in {result.duration_seconds:.2f}s")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("API: Unexpected error in monthly-report")
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "error_details": repr(e),
                "step_id": "monthly-report"
            }
        )
