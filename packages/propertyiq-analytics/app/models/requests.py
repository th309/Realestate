from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class PropertyData(BaseModel):
    """Base property data for scoring."""

    # Location
    zip_code: str = Field(..., description="5-digit ZIP code")
    state: str = Field(..., description="2-letter state code")
    county: Optional[str] = Field(None, description="County name")
    metro: Optional[str] = Field(None, description="Metro area name")

    # Price metrics
    median_price: float = Field(..., ge=0, description="Median home price")
    price_yoy_change: Optional[float] = Field(None, description="Year-over-year price change %")
    price_mom_change: Optional[float] = Field(None, description="Month-over-month price change %")

    # Market activity
    days_on_market: Optional[float] = Field(None, ge=0, description="Median days on market")
    inventory_level: Optional[float] = Field(None, ge=0, description="Active listings count")
    new_listings: Optional[float] = Field(None, ge=0, description="New listings in period")

    # Demographics
    population: Optional[int] = Field(None, ge=0, description="Population")
    median_income: Optional[float] = Field(None, ge=0, description="Median household income")
    unemployment_rate: Optional[float] = Field(None, ge=0, le=100, description="Unemployment rate %")


class PropertyIQScoreRequest(BaseModel):
    """Request model for PropertyIQ scoring."""

    property_data: PropertyData

    # PropertyIQ demand signal metrics
    sold_above_list_pct: Optional[float] = Field(None, ge=0, le=100, description="Percent sold above list price")
    median_dom: Optional[float] = Field(None, ge=0, description="Median days on market")
    months_of_supply: Optional[float] = Field(None, ge=0, description="Months of supply")


class BacktestRequest(BaseModel):
    """Request model for backtesting."""

    # Scoring parameters
    score_type: str = Field(..., pattern="^(propertyiq)$", description="Score type to backtest")

    # Date range
    start_date: date = Field(..., description="Backtest start date")
    end_date: date = Field(..., description="Backtest end date")

    # Geographic filters
    states: Optional[list[str]] = Field(None, description="Filter by state codes")
    metros: Optional[list[str]] = Field(None, description="Filter by metro areas")

    # Backtest parameters
    holding_period_months: int = Field(12, ge=1, le=60, description="Investment holding period")
    score_threshold: float = Field(70.0, ge=0, le=100, description="Minimum score threshold")
