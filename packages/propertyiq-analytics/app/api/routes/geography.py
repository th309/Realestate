"""
Geography API Routes

Provides geographic relationship and spatial analysis endpoints.
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.geography_service import get_geography_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/geography", tags=["geography"])


# === Request Models ===

class FindNeighborsRequest(BaseModel):
    """Request for finding neighboring geographies."""
    geography_id: str = Field(..., description="Geography ID (e.g., FIPS code)")
    geography_type: str = Field("county", description="Type: county, metro, zip, state")
    method: str = Field("same_state", description="Method: same_state, adjacent, nearby")


class CompareToNeighborsRequest(BaseModel):
    """Request for comparing geography to neighbors."""
    geography_id: str = Field(..., description="Geography ID to analyze")
    geography_name: str = Field(..., description="Geography name")
    geography_type: str = Field("county", description="Type: county, metro, zip")
    metrics: Optional[List[str]] = Field(
        None,
        description="Metrics to compare (None = all scores: investoredge_score, homeready_score, market_health_score)"
    )


class FindSimilarRequest(BaseModel):
    """Request for finding similar geographies."""
    geography_id: str = Field(..., description="Target geography ID")
    geography_type: str = Field("county", description="Type: county, metro, zip")
    limit: int = Field(10, ge=1, le=50, description="Max similar geographies to return")
    similarity_metrics: Optional[List[str]] = Field(
        None,
        description="Metrics to use for similarity calculation"
    )


# === Endpoints ===

@router.post("/neighbors")
async def find_neighbors(request: FindNeighborsRequest):
    """
    Find neighboring geographies.

    Methods:
    - same_state: All geographies of same type in same state (e.g., all counties in Illinois)
    - adjacent: Geographies that share a border (requires adjacency data)
    - nearby: Geographies within a radius (requires lat/lon data)

    Use this when user asks about:
    - "counties surrounding McLean County"
    - "neighboring metros"
    - "adjacent counties"
    """
    logger.info(f"POST /geography/neighbors: {request.geography_id} ({request.method})")

    try:
        service = get_geography_service()
        result = service.find_neighbors(
            geography_id=request.geography_id,
            geography_type=request.geography_type,
            method=request.method
        )
        return result
    except Exception as e:
        logger.exception("Find neighbors failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare-to-neighbors")
async def compare_to_neighbors(request: CompareToNeighborsRequest):
    """
    Compare a geography to its neighboring geographies across key metrics.

    Returns:
    - Target geography details
    - Neighbor count
    - Metric-by-metric comparison:
      - Target value
      - Neighbor average
      - Difference
      - Percentile rank (% of neighbors scored lower)
      - Overall rank
      - Better/worse than average
    - Overall assessment (significantly_better, better, similar, weaker)
    - Human-readable summary

    Use this when user asks:
    - "How does McLean County compare to surrounding counties?"
    - "Is Austin better than neighboring metros?"
    - "Compare this county to others in the state"
    """
    logger.info(f"POST /geography/compare-to-neighbors: {request.geography_name}")

    try:
        service = get_geography_service()
        result = service.compare_to_neighbors(
            geography_id=request.geography_id,
            geography_name=request.geography_name,
            geography_type=request.geography_type,
            metrics=request.metrics
        )
        return result
    except Exception as e:
        logger.exception("Compare to neighbors failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/find-similar")
async def find_similar(request: FindSimilarRequest):
    """
    Find geographies similar to the target based on scores/metrics.

    Uses Euclidean distance to calculate similarity across specified metrics.
    Returns geographies ranked by similarity (1.0 = identical, 0.0 = very different).

    Use this when user asks:
    - "What counties are similar to McLean County?"
    - "Find metros like Austin"
    - "Show me markets similar to this one"
    """
    logger.info(f"POST /geography/find-similar: {request.geography_id}")

    try:
        service = get_geography_service()
        result = service.find_similar_geographies(
            geography_id=request.geography_id,
            geography_type=request.geography_type,
            limit=request.limit,
            similarity_metrics=request.similarity_metrics
        )
        return result
    except Exception as e:
        logger.exception("Find similar failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "geography"}
