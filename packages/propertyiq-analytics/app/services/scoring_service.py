import logging
from datetime import datetime

from app.models.requests import HomeReadyScoreRequest, InvestorEdgeScoreRequest
from app.models.responses import (
    HomeReadyScoreResponse,
    InvestorEdgeScoreResponse,
    ScoreComponent,
    ROIProjection,
)

logger = logging.getLogger(__name__)


def score_to_grade(score: float) -> str:
    """Convert numeric score to letter grade."""
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    elif score >= 60:
        return "D"
    else:
        return "F"


class ScoringService:
    """Service for calculating property scores."""

    def __init__(self):
        self.model_version = "1.0.0"

    async def calculate_homeready_score(
        self, request: HomeReadyScoreRequest
    ) -> HomeReadyScoreResponse:
        """
        Calculate HomeReady score for a property/location.

        This is a placeholder implementation. The actual ML logic will be
        migrated from the existing scoring system.
        """
        logger.info(f"Calculating HomeReady score for ZIP: {request.property_data.zip_code}")

        prop = request.property_data

        # Placeholder scoring components
        # TODO: Replace with actual ML model scoring
        components = []

        # Price momentum component
        price_momentum_score = self._calculate_price_momentum_score(
            prop.price_yoy_change, prop.price_mom_change
        )
        components.append(
            ScoreComponent(
                name="Price Momentum",
                score=price_momentum_score,
                weight=0.25,
                weighted_score=price_momentum_score * 0.25,
                description="Based on year-over-year and month-over-month price changes",
            )
        )

        # Affordability component
        affordability_score = self._calculate_affordability_score(
            request.affordability_index, request.price_to_income_ratio
        )
        components.append(
            ScoreComponent(
                name="Affordability",
                score=affordability_score,
                weight=0.30,
                weighted_score=affordability_score * 0.30,
                description="Based on affordability index and price-to-income ratio",
            )
        )

        # Market activity component
        market_activity_score = self._calculate_market_activity_score(
            prop.days_on_market, prop.inventory_level
        )
        components.append(
            ScoreComponent(
                name="Market Activity",
                score=market_activity_score,
                weight=0.25,
                weighted_score=market_activity_score * 0.25,
                description="Based on days on market and inventory levels",
            )
        )

        # Economic health component
        economic_score = self._calculate_economic_score(
            prop.median_income, prop.unemployment_rate
        )
        components.append(
            ScoreComponent(
                name="Economic Health",
                score=economic_score,
                weight=0.20,
                weighted_score=economic_score * 0.20,
                description="Based on median income and unemployment rate",
            )
        )

        # Calculate overall score
        overall_score = sum(c.weighted_score for c in components)

        # Generate insights
        strengths, concerns = self._generate_homeready_insights(components, prop)

        return HomeReadyScoreResponse(
            overall_score=round(overall_score, 1),
            grade=score_to_grade(overall_score),
            components=components,
            zip_code=prop.zip_code,
            scored_at=datetime.utcnow(),
            model_version=self.model_version,
            strengths=strengths,
            concerns=concerns,
        )

    async def calculate_investor_edge_score(
        self, request: InvestorEdgeScoreRequest
    ) -> InvestorEdgeScoreResponse:
        """
        Calculate InvestorEdge score for investment analysis.

        This is a placeholder implementation. The actual ML logic will be
        migrated from the existing scoring system.
        """
        logger.info(f"Calculating InvestorEdge score for ZIP: {request.property_data.zip_code}")

        prop = request.property_data

        # Placeholder scoring components
        components = []

        # Cash flow component
        cash_flow_score = self._calculate_cash_flow_score(
            request.cap_rate, request.gross_yield
        )
        components.append(
            ScoreComponent(
                name="Cash Flow Potential",
                score=cash_flow_score,
                weight=0.30,
                weighted_score=cash_flow_score * 0.30,
                description="Based on cap rate and gross yield",
            )
        )

        # Appreciation potential component
        appreciation_score = self._calculate_appreciation_score(
            prop.price_yoy_change, prop.price_mom_change
        )
        components.append(
            ScoreComponent(
                name="Appreciation Potential",
                score=appreciation_score,
                weight=0.25,
                weighted_score=appreciation_score * 0.25,
                description="Based on historical price trends",
            )
        )

        # Rental market component
        rental_score = self._calculate_rental_market_score(
            request.median_rent, request.rent_yoy_change, request.vacancy_rate
        )
        components.append(
            ScoreComponent(
                name="Rental Market Strength",
                score=rental_score,
                weight=0.25,
                weighted_score=rental_score * 0.25,
                description="Based on rent levels, growth, and vacancy",
            )
        )

        # Risk component
        risk_score = self._calculate_risk_score(
            prop.unemployment_rate, request.vacancy_rate
        )
        components.append(
            ScoreComponent(
                name="Risk Assessment",
                score=risk_score,
                weight=0.20,
                weighted_score=risk_score * 0.20,
                description="Lower risk = higher score",
            )
        )

        # Calculate overall score
        overall_score = sum(c.weighted_score for c in components)

        # Generate ROI projections
        roi_projections = self._generate_roi_projections(request)

        # Generate investment thesis
        investment_thesis, risk_factors = self._generate_investment_insights(
            components, request
        )

        return InvestorEdgeScoreResponse(
            overall_score=round(overall_score, 1),
            grade=score_to_grade(overall_score),
            components=components,
            roi_projections=roi_projections,
            zip_code=prop.zip_code,
            scored_at=datetime.utcnow(),
            model_version=self.model_version,
            investment_thesis=investment_thesis,
            risk_factors=risk_factors,
        )

    # Placeholder scoring methods - to be replaced with actual ML logic

    def _calculate_price_momentum_score(
        self, yoy_change: float | None, mom_change: float | None
    ) -> float:
        """Placeholder: Calculate price momentum score."""
        base_score = 50.0
        if yoy_change is not None:
            # Moderate growth (3-10%) is ideal
            if 3 <= yoy_change <= 10:
                base_score += 30
            elif 0 <= yoy_change < 3:
                base_score += 15
            elif yoy_change > 10:
                base_score += 20  # High growth but some risk
            else:
                base_score -= 10  # Negative growth

        if mom_change is not None:
            if mom_change > 0:
                base_score += min(mom_change * 5, 20)

        return min(max(base_score, 0), 100)

    def _calculate_affordability_score(
        self, affordability_index: float | None, price_to_income: float | None
    ) -> float:
        """Placeholder: Calculate affordability score."""
        base_score = 50.0

        if affordability_index is not None:
            if affordability_index >= 100:
                base_score += 30
            elif affordability_index >= 80:
                base_score += 15
            else:
                base_score -= 10

        if price_to_income is not None:
            if price_to_income <= 3:
                base_score += 20
            elif price_to_income <= 5:
                base_score += 10
            else:
                base_score -= 10

        return min(max(base_score, 0), 100)

    def _calculate_market_activity_score(
        self, days_on_market: float | None, inventory: float | None
    ) -> float:
        """Placeholder: Calculate market activity score."""
        base_score = 50.0

        if days_on_market is not None:
            if days_on_market <= 30:
                base_score += 25  # Hot market
            elif days_on_market <= 60:
                base_score += 15
            elif days_on_market <= 90:
                base_score += 5
            else:
                base_score -= 10

        return min(max(base_score, 0), 100)

    def _calculate_economic_score(
        self, median_income: float | None, unemployment: float | None
    ) -> float:
        """Placeholder: Calculate economic health score."""
        base_score = 50.0

        if unemployment is not None:
            if unemployment <= 3:
                base_score += 25
            elif unemployment <= 5:
                base_score += 15
            elif unemployment <= 7:
                base_score += 5
            else:
                base_score -= 15

        if median_income is not None:
            if median_income >= 80000:
                base_score += 20
            elif median_income >= 60000:
                base_score += 10

        return min(max(base_score, 0), 100)

    def _calculate_cash_flow_score(
        self, cap_rate: float | None, gross_yield: float | None
    ) -> float:
        """Placeholder: Calculate cash flow potential score."""
        base_score = 50.0

        if cap_rate is not None:
            if cap_rate >= 8:
                base_score += 30
            elif cap_rate >= 6:
                base_score += 20
            elif cap_rate >= 4:
                base_score += 10
            else:
                base_score -= 10

        if gross_yield is not None:
            if gross_yield >= 10:
                base_score += 20
            elif gross_yield >= 7:
                base_score += 10

        return min(max(base_score, 0), 100)

    def _calculate_appreciation_score(
        self, yoy_change: float | None, mom_change: float | None
    ) -> float:
        """Placeholder: Calculate appreciation potential score."""
        return self._calculate_price_momentum_score(yoy_change, mom_change)

    def _calculate_rental_market_score(
        self, median_rent: float | None, rent_yoy: float | None, vacancy: float | None
    ) -> float:
        """Placeholder: Calculate rental market strength score."""
        base_score = 50.0

        if rent_yoy is not None:
            if rent_yoy >= 5:
                base_score += 20
            elif rent_yoy >= 2:
                base_score += 10

        if vacancy is not None:
            if vacancy <= 3:
                base_score += 25
            elif vacancy <= 5:
                base_score += 15
            elif vacancy <= 7:
                base_score += 5
            else:
                base_score -= 15

        return min(max(base_score, 0), 100)

    def _calculate_risk_score(
        self, unemployment: float | None, vacancy: float | None
    ) -> float:
        """Placeholder: Calculate risk score (higher = lower risk)."""
        base_score = 70.0

        if unemployment is not None:
            if unemployment > 7:
                base_score -= 20
            elif unemployment > 5:
                base_score -= 10

        if vacancy is not None:
            if vacancy > 10:
                base_score -= 20
            elif vacancy > 7:
                base_score -= 10

        return min(max(base_score, 0), 100)

    def _generate_homeready_insights(
        self, components: list[ScoreComponent], prop
    ) -> tuple[list[str], list[str]]:
        """Generate strengths and concerns for HomeReady score."""
        strengths = []
        concerns = []

        for comp in components:
            if comp.score >= 75:
                strengths.append(f"Strong {comp.name.lower()}")
            elif comp.score < 50:
                concerns.append(f"Weak {comp.name.lower()}")

        if not strengths:
            strengths.append("Balanced market conditions")
        if not concerns:
            concerns.append("No major concerns identified")

        return strengths[:3], concerns[:3]

    def _generate_roi_projections(
        self, request: InvestorEdgeScoreRequest
    ) -> list[ROIProjection]:
        """Generate placeholder ROI projections."""
        # Placeholder projections based on inputs
        base_appreciation = (request.property_data.price_yoy_change or 5) / 100
        base_yield = (request.gross_yield or 6) / 100

        projections = []
        for months in [12, 24, 36]:
            years = months / 12
            projected_appreciation = base_appreciation * years * 100
            projected_rental = (request.median_rent or 1500) * months
            total_return = projected_appreciation + (base_yield * years * 100)

            projections.append(
                ROIProjection(
                    period_months=months,
                    projected_appreciation=round(projected_appreciation, 1),
                    projected_rental_income=round(projected_rental, 0),
                    projected_total_return=round(total_return, 1),
                    confidence="medium",
                )
            )

        return projections

    def _generate_investment_insights(
        self, components: list[ScoreComponent], request: InvestorEdgeScoreRequest
    ) -> tuple[str, list[str]]:
        """Generate investment thesis and risk factors."""
        overall = sum(c.weighted_score for c in components)

        if overall >= 80:
            thesis = "Strong investment opportunity with favorable cash flow and appreciation potential."
        elif overall >= 65:
            thesis = "Solid investment opportunity with moderate returns expected."
        elif overall >= 50:
            thesis = "Average investment opportunity. Careful due diligence recommended."
        else:
            thesis = "Below-average investment metrics. Significant risks identified."

        risk_factors = []
        if request.vacancy_rate and request.vacancy_rate > 7:
            risk_factors.append("High vacancy rate may impact rental income")
        if request.property_data.unemployment_rate and request.property_data.unemployment_rate > 6:
            risk_factors.append("Elevated unemployment in the area")
        if request.cap_rate and request.cap_rate < 4:
            risk_factors.append("Low cap rate suggests limited cash flow potential")

        if not risk_factors:
            risk_factors.append("No major risk factors identified")

        return thesis, risk_factors


# Singleton instance
scoring_service = ScoringService()
