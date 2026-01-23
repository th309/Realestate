import logging
from fastapi import APIRouter, HTTPException

from app.models.requests import HomeReadyScoreRequest, InvestorEdgeScoreRequest
from app.models.responses import (
    HomeReadyScoreResponse,
    InvestorEdgeScoreResponse,
    ErrorResponse,
)
from app.services.scoring_service import scoring_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/score", tags=["scoring"])


@router.post(
    "/homeready",
    response_model=HomeReadyScoreResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Scoring error"},
    },
)
async def calculate_homeready_score(
    request: HomeReadyScoreRequest,
) -> HomeReadyScoreResponse:
    """
    Calculate HomeReady score for a property/location.

    The HomeReady score evaluates a location's suitability for homebuyers
    based on affordability, market conditions, and economic factors.

    Returns a score from 0-100 with component breakdowns.
    """
    try:
        logger.info(f"HomeReady score request for ZIP: {request.property_data.zip_code}")
        result = await scoring_service.calculate_homeready_score(request)
        logger.info(
            f"HomeReady score for {request.property_data.zip_code}: {result.overall_score}"
        )
        return result
    except ValueError as e:
        logger.warning(f"Invalid input for HomeReady score: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error calculating HomeReady score: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to calculate score")


@router.post(
    "/investor-edge",
    response_model=InvestorEdgeScoreResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Scoring error"},
    },
)
async def calculate_investor_edge_score(
    request: InvestorEdgeScoreRequest,
) -> InvestorEdgeScoreResponse:
    """
    Calculate InvestorEdge score for investment analysis.

    The InvestorEdge score evaluates a location's investment potential
    based on cash flow metrics, appreciation potential, and risk factors.

    Returns a score from 0-100 with ROI projections.
    """
    try:
        logger.info(
            f"InvestorEdge score request for ZIP: {request.property_data.zip_code}"
        )
        result = await scoring_service.calculate_investor_edge_score(request)
        logger.info(
            f"InvestorEdge score for {request.property_data.zip_code}: {result.overall_score}"
        )
        return result
    except ValueError as e:
        logger.warning(f"Invalid input for InvestorEdge score: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error calculating InvestorEdge score: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to calculate score")
