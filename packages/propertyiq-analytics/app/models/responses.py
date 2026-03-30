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


class PropertyIQScoreResponse(BaseModel):
    """Response model for PropertyIQ scoring."""

    overall_score: float = Field(..., ge=1, le=99, description="PropertyIQ score (1-99, 50=state average)")
    label: str = Field(..., description="Score label (e.g. EXCELLENT, GREAT, GOOD, etc.)")

    # Component breakdowns
    components: list[ScoreComponent] = Field(..., description="Score component breakdown")

    # Metadata
    zip_code: str
    scored_at: datetime = Field(default_factory=datetime.utcnow)
    model_version: str = Field(default="4.0.0")

    # Insights
    strengths: list[str] = Field(default_factory=list, description="Market strengths")
    concerns: list[str] = Field(default_factory=list, description="Market concerns")


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
