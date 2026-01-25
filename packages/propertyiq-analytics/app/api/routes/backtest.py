"""
Backtest API Routes

Exposes backtesting analysis endpoints for validating PropertyIQ scores.
"""

import logging
from typing import Optional
from datetime import date

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.backtest_service import get_backtest_service, BacktestAnalysisResult
from app.models.requests import BacktestRequest
from app.models.responses import BacktestResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/backtest", tags=["backtest"])


# Request/Response models for new endpoints

class FullBacktestRequest(BaseModel):
    """Request for comprehensive backtest analysis."""
    score_type: str = Field("investoredge", description="Score type: investoredge, homeready, market_health")
    geography_type: str = Field("metro", description="Geography level: zip, county, metro, state")
    benchmark_type: str = Field("national", description="Benchmark: national, regional, peer")
    horizons: list[int] = Field(default=[6, 12, 36, 60], description="Time horizons in months")


class DecileResultResponse(BaseModel):
    """Response for a single decile."""
    decile: str
    score_min: float
    score_max: float
    avg_actual_return: float
    avg_benchmark_return: float
    avg_excess_return: float
    observations: int
    std_dev: float
    t_statistic: float
    p_value: float
    beats_benchmark: bool


class HorizonResultResponse(BaseModel):
    """Response for a single horizon."""
    horizon_months: int
    decile_results: list[DecileResultResponse]
    top_decile_excess: float
    bottom_decile_excess: float
    spread: float
    pearson_r: float
    spearman_r: float
    r_squared: float
    validated: bool
    sample_size: int


class FullBacktestResponse(BaseModel):
    """Response for comprehensive backtest analysis."""
    success: bool
    score_type: str
    geography_type: str
    benchmark_type: str
    analysis_date: str
    horizons: list[HorizonResultResponse]
    overall_validated: bool
    confidence_grade: str
    total_observations: int
    date_range_start: str
    date_range_end: str


class DataStatusResponse(BaseModel):
    """Response for data status check."""
    success: bool
    data: dict


@router.post("/run", response_model=BacktestResponse)
async def run_backtest(request: BacktestRequest):
    """
    Run a backtest on historical data (legacy endpoint).
    """
    logger.info(f"POST /backtest/run - {request.score_type}")
    
    try:
        service = get_backtest_service()
        result = await service.run_backtest(request)
        return result
    except Exception as e:
        logger.exception("Backtest failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze", response_model=FullBacktestResponse)
async def run_full_analysis(request: FullBacktestRequest = None):
    """
    Run comprehensive backtest analysis with decile breakdown.
    
    This is the main endpoint for validating PropertyIQ scores.
    Returns performance by score decile across multiple time horizons.
    """
    logger.info("=" * 60)
    logger.info("POST /backtest/analyze")
    logger.info(f"  Request: {request}")
    logger.info("=" * 60)
    
    try:
        service = get_backtest_service()
        request = request or FullBacktestRequest()
        
        result = await service.run_full_backtest(
            score_type=request.score_type,
            geography_type=request.geography_type,
            benchmark_type=request.benchmark_type,
            horizons=request.horizons,
        )
        
        # Convert to response format
        horizons = []
        for h in result.horizons:
            deciles = [
                DecileResultResponse(
                    decile=d.decile,
                    score_min=d.score_min,
                    score_max=d.score_max,
                    avg_actual_return=round(d.avg_actual_return, 4),
                    avg_benchmark_return=round(d.avg_benchmark_return, 4),
                    avg_excess_return=round(d.avg_excess_return, 4),
                    observations=d.observations,
                    std_dev=round(d.std_dev, 4),
                    t_statistic=round(d.t_statistic, 4),
                    p_value=round(d.p_value, 4),
                    beats_benchmark=d.beats_benchmark,
                )
                for d in h.decile_results
            ]
            
            horizons.append(HorizonResultResponse(
                horizon_months=h.horizon_months,
                decile_results=deciles,
                top_decile_excess=round(h.top_decile_excess, 4),
                bottom_decile_excess=round(h.bottom_decile_excess, 4),
                spread=round(h.spread, 4),
                pearson_r=round(h.pearson_r, 4),
                spearman_r=round(h.spearman_r, 4),
                r_squared=round(h.r_squared, 4),
                validated=h.validated,
                sample_size=h.sample_size,
            ))
        
        return FullBacktestResponse(
            success=True,
            score_type=result.score_type,
            geography_type=result.geography_type,
            benchmark_type=result.benchmark_type,
            analysis_date=result.analysis_date,
            horizons=horizons,
            overall_validated=result.overall_validated,
            confidence_grade=result.confidence_grade,
            total_observations=result.total_observations,
            date_range_start=result.date_range_start,
            date_range_end=result.date_range_end,
        )
        
    except Exception as e:
        logger.exception("Full backtest analysis failed")
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "step": "backtest-analyze"
            }
        )


@router.get("/status", response_model=DataStatusResponse)
async def get_data_status():
    """
    Check the status of backtest data in the database.
    
    Returns counts of records with scores, outcomes, and excess returns.
    """
    logger.info("GET /backtest/status")
    
    try:
        service = get_backtest_service()
        status = await service.get_data_status()
        
        return DataStatusResponse(
            success=True,
            data=status
        )
    except Exception as e:
        logger.exception("Data status check failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quick-test")
async def quick_test(
    score_type: str = Query("investoredge", description="Score type to test"),
    horizon: int = Query(12, description="Horizon in months"),
):
    """
    Quick test endpoint to verify backtest functionality.
    
    Returns a simplified summary without full decile breakdown.
    """
    logger.info(f"GET /backtest/quick-test - {score_type}, {horizon}m")
    
    try:
        service = get_backtest_service()
        result = await service.run_full_backtest(
            score_type=score_type,
            geography_type="metro",
            benchmark_type="national",
            horizons=[horizon],
        )
        
        if not result.horizons:
            return {
                "success": False,
                "error": "No data available for analysis",
                "total_observations": result.total_observations,
            }
        
        h = result.horizons[0]
        
        return {
            "success": True,
            "score_type": score_type,
            "horizon_months": horizon,
            "sample_size": h.sample_size,
            "top_decile_excess_return": f"{h.top_decile_excess * 100:.2f}%",
            "bottom_decile_excess_return": f"{h.bottom_decile_excess * 100:.2f}%",
            "spread": f"{h.spread * 100:.2f}%",
            "pearson_correlation": round(h.pearson_r, 4),
            "r_squared": round(h.r_squared, 4),
            "validated": h.validated,
            "confidence_grade": result.confidence_grade,
            "interpretation": (
                f"High {score_type} scores {'beat' if h.top_decile_excess > 0 else 'trailed'} "
                f"the benchmark by {abs(h.top_decile_excess * 100):.1f}%. "
                f"Low scores {'beat' if h.bottom_decile_excess > 0 else 'trailed'} by {abs(h.bottom_decile_excess * 100):.1f}%."
            ),
        }
        
    except Exception as e:
        logger.exception("Quick test failed")
        return {
            "success": False,
            "error": str(e),
        }
