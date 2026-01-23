import logging
from fastapi import APIRouter, HTTPException

from app.models.requests import BacktestRequest
from app.models.responses import BacktestResponse, ErrorResponse
from app.services.backtest_service import backtest_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/backtest", tags=["backtest"])


@router.post(
    "/run",
    response_model=BacktestResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Backtest error"},
    },
)
async def run_backtest(request: BacktestRequest) -> BacktestResponse:
    """
    Run a backtest on historical scoring data.

    Evaluates the predictive accuracy of scoring models by comparing
    historical predictions to actual outcomes.

    Parameters:
    - score_type: "homeready" or "investor-edge"
    - start_date/end_date: Date range for backtest
    - states/metros: Optional geographic filters
    - holding_period_months: Investment horizon for return calculation
    - score_threshold: Minimum score to consider as "high score" prediction

    Returns accuracy metrics and return comparisons.
    """
    try:
        logger.info(
            f"Backtest request: {request.score_type} from {request.start_date} to {request.end_date}"
        )

        if request.start_date >= request.end_date:
            raise ValueError("start_date must be before end_date")

        result = await backtest_service.run_backtest(request)

        logger.info(
            f"Backtest completed: accuracy={result.metrics.accuracy:.2%}, "
            f"excess_return={result.metrics.excess_return:.1f}%"
        )
        return result

    except ValueError as e:
        logger.warning(f"Invalid backtest request: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error running backtest: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to run backtest")
