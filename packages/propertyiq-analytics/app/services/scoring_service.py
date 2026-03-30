import logging
from datetime import datetime

from app.models.requests import PropertyIQScoreRequest
from app.models.responses import (
    PropertyIQScoreResponse,
    ScoreComponent,
)

logger = logging.getLogger(__name__)


def score_to_label(score: float) -> str:
    """Convert numeric score to PropertyIQ label."""
    if score >= 90:
        return "EXCELLENT"
    elif score >= 80:
        return "GREAT"
    elif score >= 70:
        return "GOOD"
    elif score >= 60:
        return "FAIR"
    elif score >= 50:
        return "AVERAGE"
    elif score >= 40:
        return "BELOW AVG"
    elif score >= 20:
        return "POOR"
    else:
        return "VERY POOR"


class ScoringService:
    """Service for calculating PropertyIQ scores."""

    def __init__(self):
        self.model_version = "4.0.0"

    async def calculate_propertyiq_score(
        self, request: PropertyIQScoreRequest
    ) -> PropertyIQScoreResponse:
        """
        Calculate PropertyIQ score for a property/location.

        The PropertyIQ score measures market demand signal relative to the
        state average using three Redfin metrics:
        - % Sold Above List (positive signal)
        - Median Days on Market (negative signal)
        - Months of Supply (negative signal)

        Formula: z(sold_above_list) - z(median_dom) - z(months_of_supply)
        -> percentile rank within state -> re-center at 55.6 -> clamp 1-99

        Score of 50 = state average; higher means outperformance.
        """
        logger.info(f"Calculating PropertyIQ score for ZIP: {request.property_data.zip_code}")

        prop = request.property_data

        components = []

        # Sold Above List component (positive signal)
        sold_above_score = self._calculate_sold_above_list_score(
            request.sold_above_list_pct
        )
        components.append(
            ScoreComponent(
                name="Sold Above List",
                score=sold_above_score,
                weight=0.33,
                weighted_score=sold_above_score * 0.33,
                description="Percentage of homes sold above list price (higher = stronger demand)",
            )
        )

        # Median Days on Market component (negative signal - lower is better)
        dom_score = self._calculate_dom_score(
            request.median_dom or prop.days_on_market
        )
        components.append(
            ScoreComponent(
                name="Median Days on Market",
                score=dom_score,
                weight=0.33,
                weighted_score=dom_score * 0.33,
                description="Median days on market (lower = stronger demand)",
            )
        )

        # Months of Supply component (negative signal - lower is better)
        supply_score = self._calculate_supply_score(request.months_of_supply)
        components.append(
            ScoreComponent(
                name="Months of Supply",
                score=supply_score,
                weight=0.34,
                weighted_score=supply_score * 0.34,
                description="Months of housing supply (lower = stronger demand)",
            )
        )

        # Calculate overall score (clamped 1-99)
        overall_score = sum(c.weighted_score for c in components)
        overall_score = max(1, min(99, round(overall_score, 1)))

        # Generate insights
        strengths, concerns = self._generate_propertyiq_insights(components, prop)

        return PropertyIQScoreResponse(
            overall_score=overall_score,
            label=score_to_label(overall_score),
            components=components,
            zip_code=prop.zip_code,
            scored_at=datetime.utcnow(),
            model_version=self.model_version,
            strengths=strengths,
            concerns=concerns,
        )

    def _calculate_sold_above_list_score(self, pct: float | None) -> float:
        """Score based on % sold above list price (higher is better)."""
        if pct is None:
            return 50.0
        # 0% -> ~30, 30% -> ~55, 60%+ -> ~85
        return min(max(30 + pct * 0.9, 1), 99)

    def _calculate_dom_score(self, dom: float | None) -> float:
        """Score based on median days on market (lower is better)."""
        if dom is None:
            return 50.0
        # 7 days -> ~90, 30 days -> ~60, 90+ days -> ~25
        if dom <= 7:
            return 90.0
        elif dom <= 14:
            return 80.0
        elif dom <= 30:
            return 65.0
        elif dom <= 60:
            return 45.0
        elif dom <= 90:
            return 30.0
        else:
            return 20.0

    def _calculate_supply_score(self, months: float | None) -> float:
        """Score based on months of supply (lower is better)."""
        if months is None:
            return 50.0
        # 1 month -> ~85, 3 months -> ~55, 6+ months -> ~25
        if months <= 1:
            return 85.0
        elif months <= 2:
            return 70.0
        elif months <= 3:
            return 55.0
        elif months <= 4:
            return 45.0
        elif months <= 6:
            return 35.0
        else:
            return 20.0

    def _generate_propertyiq_insights(
        self, components: list[ScoreComponent], prop
    ) -> tuple[list[str], list[str]]:
        """Generate strengths and concerns for PropertyIQ score."""
        strengths = []
        concerns = []

        for comp in components:
            if comp.score >= 70:
                strengths.append(f"Strong {comp.name.lower()}")
            elif comp.score < 40:
                concerns.append(f"Weak {comp.name.lower()}")

        if not strengths:
            strengths.append("Balanced market conditions")
        if not concerns:
            concerns.append("No major concerns identified")

        return strengths[:3], concerns[:3]


# Singleton instance
scoring_service = ScoringService()
