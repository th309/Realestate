import logging
from fastapi import APIRouter, HTTPException

from app.models.requests import PropertyIQScoreRequest
from app.models.responses import (
    PropertyIQScoreResponse,
    ErrorResponse,
)
from app.services.scoring_service import scoring_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/score", tags=["scoring"])


@router.post(
    "/propertyiq",
    response_model=PropertyIQScoreResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Scoring error"},
    },
)
async def calculate_propertyiq_score(
    request: PropertyIQScoreRequest,
) -> PropertyIQScoreResponse:
    """
    Calculate PropertyIQ score for a property/location.

    The PropertyIQ score measures market demand signal relative to the state
    average. A score of 50 means state-average; higher means outperformance.

    Formula: z(sold_above_list) - z(median_dom) - z(months_of_supply)
    -> percentile rank within state -> re-center at 55.6 -> clamp 1-99

    Returns a score from 1-99 with component breakdowns.
    """
    try:
        logger.info(f"PropertyIQ score request for ZIP: {request.property_data.zip_code}")
        result = await scoring_service.calculate_propertyiq_score(request)
        logger.info(
            f"PropertyIQ score for {request.property_data.zip_code}: {result.overall_score}"
        )
        return result
    except ValueError as e:
        logger.warning(f"Invalid input for PropertyIQ score: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error calculating PropertyIQ score: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to calculate score")
