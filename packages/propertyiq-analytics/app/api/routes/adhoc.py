"""
Ad-hoc Analysis API Routes

Provides endpoints for dynamic, on-the-fly analysis queries.
Designed to be called by the LLM tool-use system.
"""

import logging
from typing import Optional, List
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.adhoc_analysis_service import (
    get_adhoc_service,
    FilterCriteria
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/adhoc", tags=["adhoc-analysis"])


# === Request Models ===

class FilterRequest(BaseModel):
    """Request to filter the dataset."""
    geography_type: str = Field("metro", description="Geography level: state, metro, county, zip")
    states: Optional[List[str]] = Field(None, description="State codes to include (e.g., ['TX', 'CA'])")
    metros: Optional[List[str]] = Field(None, description="Metro IDs to include")
    min_score: Optional[float] = Field(None, description="Minimum score threshold (0-100)")
    max_score: Optional[float] = Field(None, description="Maximum score threshold (0-100)")
    score_type: str = Field("investoredge_score", description="Score column to use")
    start_date: Optional[date] = Field(None, description="Start date for time filter")
    end_date: Optional[date] = Field(None, description="End date for time filter")


class AnalyzeRequest(BaseModel):
    """Request to analyze filtered data."""
    filter: FilterRequest
    horizons: List[int] = Field(default=[12, 36], description="Outcome horizons in months")
    include_chart_data: bool = Field(default=False, description="Include chart-ready data")


class CompareRequest(BaseModel):
    """Request to compare filtered data to benchmark."""
    filter: FilterRequest
    benchmark_type: str = Field("national", description="Benchmark type: national, regional")


class RankRequest(BaseModel):
    """Request to get top/bottom performers."""
    filter: FilterRequest
    limit: int = Field(10, ge=1, le=100, description="Number of results to return")
    ascending: bool = Field(False, description="If true, returns bottom performers")


class TimeSeriesRequest(BaseModel):
    """Request for time series data."""
    geography_id: str = Field(..., description="Geography ID to get history for")
    geography_type: str = Field("metro", description="Geography type")
    metrics: List[str] = Field(default=["investoredge_score"], description="Metrics to retrieve")
    months: int = Field(24, ge=1, le=120, description="Number of months of history")


# === Endpoints ===

@router.get("/metadata")
async def get_metadata():
    """
    Get available filter options and metadata.
    
    Returns information about available states, metros, score types, etc.
    Use this to understand what filters are available.
    """
    logger.info("GET /adhoc/metadata")
    
    try:
        service = get_adhoc_service()
        data = service.get_available_filters()
        
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        logger.exception("Metadata retrieval failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/filter")
async def filter_data(request: FilterRequest):
    """
    Filter the dataset and return summary stats.
    
    Use this to understand how many records match your criteria
    before running full analysis.
    """
    logger.info(f"POST /adhoc/filter: {request.model_dump()}")
    
    try:
        service = get_adhoc_service()
        criteria = FilterCriteria(
            geography_type=request.geography_type,
            states=request.states,
            metros=request.metros,
            min_score=request.min_score,
            max_score=request.max_score,
            score_type=request.score_type,
            start_date=request.start_date,
            end_date=request.end_date
        )
        
        df = service.filter_data(criteria)
        
        # Get date range from filtered data
        date_range = {"min": None, "max": None}
        if len(df) > 0 and 'period_date' in df.columns:
            date_range["min"] = str(df['period_date'].min())
            date_range["max"] = str(df['period_date'].max())
        
        return {
            "success": True,
            "record_count": len(df),
            "geography_count": int(df["geography_id"].nunique()) if len(df) > 0 and "geography_id" in df.columns else 0,
            "date_range": date_range,
            "filter_applied": request.model_dump(exclude_none=True)
        }
    except Exception as e:
        logger.exception("Filter failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_data(request: AnalyzeRequest):
    """
    Filter and analyze the dataset.
    
    Returns summary statistics, correlations, and top/bottom performers
    for the filtered data.
    """
    logger.info(f"POST /adhoc/analyze: geography_type={request.filter.geography_type}, states={request.filter.states}")
    
    try:
        service = get_adhoc_service()
        criteria = FilterCriteria(
            geography_type=request.filter.geography_type,
            states=request.filter.states,
            metros=request.filter.metros,
            min_score=request.filter.min_score,
            max_score=request.filter.max_score,
            score_type=request.filter.score_type,
            start_date=request.filter.start_date,
            end_date=request.filter.end_date
        )
        
        df = service.filter_data(criteria)
        result = service.analyze_filtered_data(
            df,
            score_type=request.filter.score_type,
            horizons=request.horizons,
            include_chart_data=request.include_chart_data
        )
        return {
            "success": result.success,
            "record_count": result.record_count,
            "geography_count": result.geography_count,
            "summary_stats": result.summary_stats,
            "correlations": result.correlations,
            "top_performers": result.top_performers,
            "bottom_performers": result.bottom_performers,
            "chart_data": result.chart_data,
            "error": result.error
        }
    except Exception as e:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare")
async def compare_to_benchmark(request: CompareRequest):
    """
    Compare filtered data to a benchmark.
    
    Returns how the filtered markets compare to national or regional averages
    for scores and appreciation.
    """
    logger.info(f"POST /adhoc/compare: benchmark={request.benchmark_type}")
    
    try:
        service = get_adhoc_service()
        criteria = FilterCriteria(
            geography_type=request.filter.geography_type,
            states=request.filter.states,
            metros=request.filter.metros,
            min_score=request.filter.min_score,
            max_score=request.filter.max_score,
            score_type=request.filter.score_type
        )
        
        df = service.filter_data(criteria)
        comparison = service.compare_to_benchmark(
            df,
            benchmark_type=request.benchmark_type,
            score_type=request.filter.score_type
        )
        
        return {
            "success": "error" not in comparison,
            "comparison": comparison
        }
    except Exception as e:
        logger.exception("Comparison failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rank")
async def get_rankings(request: RankRequest):
    """
    Get top or bottom performers from filtered data.
    
    Returns a ranked list of markets based on score or other metrics.
    """
    logger.info(f"POST /adhoc/rank: limit={request.limit}, ascending={request.ascending}")
    
    try:
        service = get_adhoc_service()
        criteria = FilterCriteria(
            geography_type=request.filter.geography_type,
            states=request.filter.states,
            metros=request.filter.metros,
            min_score=request.filter.min_score,
            max_score=request.filter.max_score,
            score_type=request.filter.score_type
        )
        
        df = service.filter_data(criteria)
        rankings = service.get_rankings(
            df,
            score_type=request.filter.score_type,
            limit=request.limit,
            ascending=request.ascending
        )
        
        return {
            "success": "error" not in rankings,
            **rankings
        }
    except Exception as e:
        logger.exception("Ranking failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/history")
async def get_time_series(request: TimeSeriesRequest):
    """
    Get time series data for a specific geography.
    
    Returns historical values for the specified metrics over time.
    """
    logger.info(f"POST /adhoc/history: {request.geography_id} ({request.geography_type})")
    
    try:
        service = get_adhoc_service()
        result = service.get_time_series(
            geography_id=request.geography_id,
            geography_type=request.geography_type,
            metrics=request.metrics,
            months=request.months
        )
        
        return {
            "success": "error" not in result,
            **result
        }
    except Exception as e:
        logger.exception("Time series retrieval failed")
        raise HTTPException(status_code=500, detail=str(e))
