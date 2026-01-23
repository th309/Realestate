from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ScoreComponent(BaseModel):
    """Individual score component breakdown."""

    name: str = Field(..., description="Component name")
    score: float = Field(..., ge=0, le=100, description="Component score 0-100")
    weight: float = Field(..., ge=0, le=1, description="Component weight")
    weighted_score: float = Field(..., description="Score * weight")
    description: Optional[str] = Field(None, description="Explanation of score")


class HomeReadyScoreResponse(BaseModel):
    """Response model for HomeReady scoring."""

    overall_score: float = Field(..., ge=0, le=100, description="Overall HomeReady score")
    grade: str = Field(..., description="Letter grade A-F")

    # Component breakdowns
    components: list[ScoreComponent] = Field(..., description="Score component breakdown")

    # Metadata
    zip_code: str
    scored_at: datetime = Field(default_factory=datetime.utcnow)
    model_version: str = Field(default="1.0.0")

    # Insights
    strengths: list[str] = Field(default_factory=list, description="Market strengths")
    concerns: list[str] = Field(default_factory=list, description="Market concerns")


class ROIProjection(BaseModel):
    """ROI projection for investment."""

    period_months: int
    projected_appreciation: float = Field(..., description="Expected price appreciation %")
    projected_rental_income: float = Field(..., description="Expected rental income")
    projected_total_return: float = Field(..., description="Expected total return %")
    confidence: str = Field(..., description="Confidence level: low/medium/high")


class InvestorEdgeScoreResponse(BaseModel):
    """Response model for InvestorEdge scoring."""

    overall_score: float = Field(..., ge=0, le=100, description="Overall InvestorEdge score")
    grade: str = Field(..., description="Letter grade A-F")

    # Component breakdowns
    components: list[ScoreComponent] = Field(..., description="Score component breakdown")

    # ROI projections
    roi_projections: list[ROIProjection] = Field(..., description="ROI projections at different horizons")

    # Metadata
    zip_code: str
    scored_at: datetime = Field(default_factory=datetime.utcnow)
    model_version: str = Field(default="1.0.0")

    # Investment insights
    investment_thesis: str = Field(..., description="Summary investment thesis")
    risk_factors: list[str] = Field(default_factory=list, description="Key risk factors")


class BacktestMetrics(BaseModel):
    """Backtest performance metrics."""

    total_predictions: int = Field(..., description="Total number of predictions")
    accuracy: float = Field(..., ge=0, le=1, description="Overall accuracy")
    precision: float = Field(..., ge=0, le=1, description="Precision score")
    recall: float = Field(..., ge=0, le=1, description="Recall score")
    f1_score: float = Field(..., ge=0, le=1, description="F1 score")

    # Return metrics
    avg_return_high_score: float = Field(..., description="Avg return for high-score predictions")
    avg_return_low_score: float = Field(..., description="Avg return for low-score predictions")
    excess_return: float = Field(..., description="Excess return vs benchmark")


class BacktestResponse(BaseModel):
    """Response model for backtesting."""

    # Request echo
    score_type: str
    start_date: str
    end_date: str
    holding_period_months: int

    # Results
    metrics: BacktestMetrics

    # Breakdown by geography
    state_breakdown: Optional[dict[str, BacktestMetrics]] = Field(None)

    # Metadata
    completed_at: datetime = Field(default_factory=datetime.utcnow)
    execution_time_ms: int = Field(..., description="Execution time in milliseconds")


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(default="healthy")
    version: str = Field(default="1.0.0")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ErrorResponse(BaseModel):
    """Standard error response."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[dict] = Field(None, description="Additional error details")
