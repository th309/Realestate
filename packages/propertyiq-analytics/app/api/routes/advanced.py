"""
Advanced Analysis API Routes

Provides ML-powered analysis endpoints for the Analytics Assistant:
- Regression analysis
- Feature importance
- Market clustering
- Weight optimization
- Chart generation
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.advanced_analysis_service import get_advanced_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/advanced", tags=["advanced-analysis"])


# === Request Models ===

class RegressionRequest(BaseModel):
    """Request for regression analysis."""
    geography_type: str = Field("metro", description="Geography level")
    target: str = Field("actual_appreciation_12m", description="Target variable")
    features: Optional[List[str]] = Field(None, description="Features to use (None=auto)")
    model_type: str = Field("ols", description="'ols' or 'ridge'")
    states: Optional[List[str]] = Field(None, description="State filter")


class FeatureImportanceRequest(BaseModel):
    """Request for feature importance analysis."""
    geography_type: str = Field("metro", description="Geography level")
    target: str = Field("actual_appreciation_12m", description="Target variable")
    features: Optional[List[str]] = Field(None, description="Features to use")
    method: str = Field("random_forest", description="'random_forest' or 'gradient_boosting'")
    states: Optional[List[str]] = Field(None, description="State filter")


class ClusterRequest(BaseModel):
    """Request for market clustering."""
    geography_type: str = Field("metro", description="Geography level")
    features: Optional[List[str]] = Field(None, description="Features to cluster on")
    n_clusters: int = Field(5, ge=2, le=20, description="Number of clusters")
    states: Optional[List[str]] = Field(None, description="State filter")


class OptimizeWeightsRequest(BaseModel):
    """Request for weight optimization."""
    geography_type: str = Field("metro", description="Geography level")
    score_type: str = Field("investoredge", description="'investoredge' or 'homeready'")
    target: str = Field("actual_appreciation_12m", description="Target to optimize for")
    states: Optional[List[str]] = Field(None, description="State filter")


class ChartRequest(BaseModel):
    """Request for chart generation."""
    chart_type: str = Field(..., description="'scatter', 'bar', 'histogram', 'box'")
    geography_type: str = Field("metro", description="Geography level")
    x_column: Optional[str] = Field(None, description="X-axis column")
    y_column: Optional[str] = Field(None, description="Y-axis column")
    color_column: Optional[str] = Field(None, description="Color grouping")
    title: Optional[str] = Field(None, description="Chart title")
    states: Optional[List[str]] = Field(None, description="State filter")
    limit: int = Field(100, ge=10, le=500, description="Max data points")


class RawMetricAnalysisRequest(BaseModel):
    """Request for raw metric analysis."""
    geography_type: str = Field("metro", description="Geography level")
    target: str = Field("actual_appreciation_12m", description="Target variable")
    data_sources: Optional[List[str]] = Field(
        None, 
        description="Data sources to include: zillow, realtor, census, economic, calculated"
    )
    states: Optional[List[str]] = Field(None, description="State filter")


# === Endpoints ===

@router.post("/regression")
async def run_regression(request: RegressionRequest):
    """
    Run regression analysis to find which features predict outcomes.
    
    Returns coefficients, p-values, and feature rankings by importance.
    Use this to understand which metrics drive appreciation.
    """
    logger.info(f"POST /advanced/regression: target={request.target}, model={request.model_type}")
    
    try:
        service = get_advanced_service()
        result = service.run_regression(
            geography_type=request.geography_type,
            target=request.target,
            features=request.features,
            model_type=request.model_type,
            states=request.states
        )
        
        return {
            "success": result.success,
            "model_type": result.model_type,
            "target_variable": result.target_variable,
            "r_squared": result.r_squared,
            "adj_r_squared": result.adj_r_squared,
            "mae": result.mae,
            "coefficients": result.coefficients,
            "p_values": result.p_values,
            "feature_rankings": result.feature_rankings,
            "sample_size": result.sample_size,
            "error": result.error
        }
    except Exception as e:
        logger.exception("Regression failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/feature-importance")
async def get_feature_importance(request: FeatureImportanceRequest):
    """
    Calculate feature importance using tree-based methods.
    
    Returns ranked list of features by their predictive power.
    Use Random Forest for general importance, Gradient Boosting for more nuanced ranking.
    """
    logger.info(f"POST /advanced/feature-importance: method={request.method}")
    
    try:
        service = get_advanced_service()
        result = service.get_feature_importance(
            geography_type=request.geography_type,
            target=request.target,
            features=request.features,
            method=request.method,
            states=request.states
        )
        
        return {
            "success": result.success,
            "method": result.method,
            "target_variable": result.target_variable,
            "importances": result.importances,
            "r_squared": result.r_squared,
            "sample_size": result.sample_size,
            "error": result.error
        }
    except Exception as e:
        logger.exception("Feature importance failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cluster")
async def cluster_markets(request: ClusterRequest):
    """
    Cluster markets into groups based on similarity.
    
    Uses K-means clustering to group markets with similar characteristics.
    Returns cluster assignments and summary statistics for each cluster.
    """
    logger.info(f"POST /advanced/cluster: n_clusters={request.n_clusters}")
    
    try:
        service = get_advanced_service()
        result = service.cluster_markets(
            geography_type=request.geography_type,
            features=request.features,
            n_clusters=request.n_clusters,
            states=request.states
        )
        
        return {
            "success": result.success,
            "n_clusters": result.n_clusters,
            "cluster_summary": result.cluster_summary,
            "market_assignments": result.market_assignments,
            "silhouette_score": result.silhouette_score,
            "inertia": result.inertia,
            "error": result.error
        }
    except Exception as e:
        logger.exception("Clustering failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/optimize-weights")
async def optimize_weights(request: OptimizeWeightsRequest):
    """
    Find optimal weights for score components to maximize correlation with outcomes.
    
    Uses Ridge regression to find weights that would have maximized predictive power.
    Compares baseline (equal weights) vs optimized weights.
    """
    logger.info(f"POST /advanced/optimize-weights: score_type={request.score_type}")
    
    try:
        service = get_advanced_service()
        result = service.optimize_weights(
            geography_type=request.geography_type,
            score_type=request.score_type,
            target=request.target,
            states=request.states
        )
        
        return {
            "success": result.success,
            "optimal_weights": result.optimal_weights,
            "baseline_correlation": result.baseline_correlation,
            "optimized_correlation": result.optimized_correlation,
            "improvement_pct": result.improvement_pct,
            "tested_combinations": result.tested_combinations,
            "error": result.error
        }
    except Exception as e:
        logger.exception("Weight optimization failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chart")
async def generate_chart(request: ChartRequest):
    """
    Generate a Plotly chart for visualization.
    
    Supported types: scatter, bar, histogram, box.
    Returns chart as HTML and Plotly JSON for frontend rendering.
    """
    logger.info(f"POST /advanced/chart: type={request.chart_type}")
    
    try:
        service = get_advanced_service()
        result = service.generate_chart(
            chart_type=request.chart_type,
            geography_type=request.geography_type,
            x_column=request.x_column,
            y_column=request.y_column,
            color_column=request.color_column,
            title=request.title,
            states=request.states,
            limit=request.limit
        )
        
        return {
            "success": result.success,
            "chart_type": result.chart_type,
            "title": result.title,
            "html": result.html,
            "plotly_json": result.plotly_json,
            "error": result.error
        }
    except Exception as e:
        logger.exception("Chart generation failed")
        raise HTTPException(status_code=500, detail=str(e))


# === RAW METRIC ENDPOINTS (query Supabase directly) ===

@router.post("/raw-metrics/analyze")
async def analyze_raw_metrics(request: RawMetricAnalysisRequest):
    """
    Analyze raw metrics from multiple data sources against outcomes.
    
    This queries Supabase directly (not cache) to find which raw metrics
    from Zillow, Realtor, Census, Economic data best predict appreciation.
    
    Returns:
    - Top correlations across all raw metrics
    - Regression analysis on top predictors
    - Feature importance rankings
    
    Note: This may take 2-5 seconds as it queries the database directly.
    """
    logger.info(f"POST /advanced/raw-metrics/analyze: target={request.target}")
    
    try:
        service = get_advanced_service()
        result = service.analyze_raw_metrics(
            geography_type=request.geography_type,
            target=request.target,
            data_sources=request.data_sources,
            states=request.states
        )
        
        return result
    except Exception as e:
        logger.exception("Raw metric analysis failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/raw-metrics/summary")
async def get_raw_metric_summary(
    geography_type: str = "metro",
    states: Optional[str] = None
):
    """
    Get summary of available raw metrics from each data source.

    Returns list of available metrics from Zillow, Realtor, Census, Economic, Calculated.
    """
    logger.info(f"GET /advanced/raw-metrics/summary: geo={geography_type}")

    try:
        service = get_advanced_service()
        state_list = states.split(",") if states else None
        result = service.get_raw_metric_summary(
            geography_type=geography_type,
            states=state_list
        )

        return result
    except Exception as e:
        logger.exception("Raw metric summary failed")
        raise HTTPException(status_code=500, detail=str(e))


# === BACKTEST / QUINTILE VALIDATION ENDPOINTS ===

class BacktestRequest(BaseModel):
    """Request for backtest analysis."""
    score_type: str = Field("investoredge", description="Score type: investoredge, homeready, market_health")
    geography_type: str = Field("metro", description="Geography level")
    benchmark_type: str = Field("national", description="Benchmark: national, regional, peer")
    horizons: Optional[List[int]] = Field(None, description="Time horizons in months (default: [12, 36, 60])")
    use_cache: bool = Field(True, description="Use cached data for faster results")


class QuintileAnalysisRequest(BaseModel):
    """Request for quintile validation analysis."""
    score_type: str = Field("investoredge", description="Score type to validate")
    geography_type: str = Field("metro", description="Geography level")
    horizon_months: int = Field(36, description="Time horizon in months (12, 36, or 60)")
    use_cache: bool = Field(True, description="Use cached data")


class FormulaComparisonRequest(BaseModel):
    """Request for comparing 3 vs 9 formula approach."""
    geography_types: List[str] = Field(["metro", "county", "zip"], description="Geography levels to analyze")
    score_types: List[str] = Field(["investoredge", "homeready", "market_health"], description="Scores to compare")
    horizon_months: int = Field(36, description="Time horizon for comparison")


@router.post("/backtest")
async def run_backtest(request: BacktestRequest):
    """
    Run comprehensive backtest analysis with quintile validation.

    Returns:
    - Quintile breakdown with beat rates
    - Top/Bottom quintile excess returns
    - SPREAD (top - bottom)
    - T-test p-values
    - Spearman correlation
    - Confidence grade (A-F)

    This is the full backtest report including the exact summary table format
    with all validation metrics.
    """
    logger.info(f"POST /advanced/backtest: {request.score_type} / {request.geography_type}")

    try:
        from app.services.backtest_service import BacktestService

        service = BacktestService()
        result = await service.run_full_backtest(
            score_type=request.score_type,
            geography_type=request.geography_type,
            benchmark_type=request.benchmark_type,
            horizons=request.horizons,
            use_cache=request.use_cache
        )

        # Convert dataclass to dict
        return {
            "success": True,
            "score_type": result.score_type,
            "geography_type": result.geography_type,
            "benchmark_type": result.benchmark_type,
            "analysis_date": result.analysis_date,
            "overall_validated": result.overall_validated,
            "confidence_grade": result.confidence_grade,
            "total_observations": result.total_observations,
            "date_range_start": result.date_range_start,
            "date_range_end": result.date_range_end,
            "data_source": result.data_source,
            "validation_summary": {
                "score_type": result.validation_summary.score_type,
                "top_quintile_excess": result.validation_summary.top_quintile_excess,
                "bottom_quintile_excess": result.validation_summary.bottom_quintile_excess,
                "spread": result.validation_summary.spread,
                "top_quintile_beat_rate": result.validation_summary.top_quintile_beat_rate,
                "bottom_quintile_beat_rate": result.validation_summary.bottom_quintile_beat_rate,
                "t_test_pvalue": result.validation_summary.t_test_pvalue,
                "spearman_correlation": result.validation_summary.spearman_correlation,
                "observations": result.validation_summary.observations,
                "validated": result.validation_summary.validated
            } if result.validation_summary else None,
            "quintile_results": [
                {
                    "quintile": q.quintile,
                    "score_min": q.score_min,
                    "score_max": q.score_max,
                    "avg_excess_return": q.avg_excess_return,
                    "beat_market_rate": q.beat_market_rate,
                    "observations": q.observations,
                    "t_statistic": q.t_statistic,
                    "p_value": q.p_value
                }
                for q in result.quintile_results
            ],
            "horizons": [
                {
                    "horizon_months": h.horizon_months,
                    "top_decile_excess": h.top_decile_excess,
                    "bottom_decile_excess": h.bottom_decile_excess,
                    "spread": h.spread,
                    "pearson_r": h.pearson_r,
                    "spearman_r": h.spearman_r,
                    "r_squared": h.r_squared,
                    "validated": h.validated,
                    "sample_size": h.sample_size
                }
                for h in result.horizons
            ]
        }
    except Exception as e:
        logger.exception("Backtest failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quintile-analysis")
async def run_quintile_analysis(request: QuintileAnalysisRequest):
    """
    Run quintile validation analysis for a single score and horizon.

    Returns detailed quintile breakdown with beat rates, the exact format
    needed for the validation summary table:
    - Top Quintile Excess Return
    - Bottom Quintile Excess Return
    - SPREAD
    - T-test p-value
    - Spearman Correlation
    - Beat rates for top and bottom quintiles

    Faster than full backtest if you only need one horizon.
    """
    logger.info(f"POST /advanced/quintile-analysis: {request.score_type} @ {request.horizon_months}m")

    try:
        from app.services.backtest_service import BacktestService

        service = BacktestService()

        # Run backtest with single horizon
        result = await service.run_full_backtest(
            score_type=request.score_type,
            geography_type=request.geography_type,
            benchmark_type="national",
            horizons=[request.horizon_months],
            use_cache=request.use_cache
        )

        # Return focused quintile results
        return {
            "success": True,
            "score_type": request.score_type,
            "geography_type": request.geography_type,
            "horizon_months": request.horizon_months,
            "validation_summary": {
                "top_quintile_excess": result.validation_summary.top_quintile_excess,
                "bottom_quintile_excess": result.validation_summary.bottom_quintile_excess,
                "spread": result.validation_summary.spread,
                "top_quintile_beat_rate": result.validation_summary.top_quintile_beat_rate,
                "bottom_quintile_beat_rate": result.validation_summary.bottom_quintile_beat_rate,
                "t_test_pvalue": result.validation_summary.t_test_pvalue,
                "spearman_correlation": result.validation_summary.spearman_correlation,
                "observations": result.validation_summary.observations,
                "validated": result.validation_summary.validated
            } if result.validation_summary else None,
            "quintile_details": [
                {
                    "quintile": q.quintile,
                    "score_range": f"{q.score_min:.1f}-{q.score_max:.1f}",
                    "avg_excess_return": q.avg_excess_return,
                    "beat_rate": q.beat_market_rate,
                    "observations": q.observations,
                    "significant": q.p_value < 0.05
                }
                for q in result.quintile_results
            ],
            "confidence_grade": result.confidence_grade,
            "total_observations": result.total_observations
        }
    except Exception as e:
        logger.exception("Quintile analysis failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/formula-comparison")
async def compare_formulas(request: FormulaComparisonRequest):
    """
    Compare 3-formula vs 9-formula approach.

    Analyzes whether you should use:
    - 3 formulas: One per score type (InvestorEdge, HomeReady, MarketHealth)
    - 9 formulas: One per score type × geography level (metro, county, zip)

    Returns:
    - Validation metrics for each geography level
    - Top predictive metrics per geography
    - Recommendation: Use 3 or 9 formulas?
    - Reasoning based on spread consistency and metric overlap
    """
    logger.info(f"POST /advanced/formula-comparison: {len(request.geography_types)} geo levels")

    try:
        from app.services.backtest_service import BacktestService

        service = BacktestService()
        results_by_geo = {}

        # Run backtest for each geography level
        for geo_type in request.geography_types:
            geo_results = {}
            for score_type in request.score_types:
                result = await service.run_full_backtest(
                    score_type=score_type,
                    geography_type=geo_type,
                    benchmark_type="national",
                    horizons=[request.horizon_months],
                    use_cache=True
                )

                if result.validation_summary:
                    geo_results[score_type] = {
                        "spread": result.validation_summary.spread,
                        "spearman_r": result.validation_summary.spearman_correlation,
                        "top_beat_rate": result.validation_summary.top_quintile_beat_rate,
                        "validated": result.validation_summary.validated,
                        "observations": result.validation_summary.observations
                    }

            results_by_geo[geo_type] = geo_results

        # Analyze consistency across geography levels
        # If metrics are similar, suggest 3 formulas; if different, suggest 9
        spreads = []
        for geo_type, scores in results_by_geo.items():
            for score_type, metrics in scores.items():
                spreads.append(metrics["spread"])

        # Calculate coefficient of variation for spread
        import numpy as np
        spread_mean = np.mean(spreads) if spreads else 0
        spread_std = np.std(spreads) if spreads else 0
        spread_cv = (spread_std / spread_mean * 100) if spread_mean != 0 else 0

        # Recommendation logic:
        # Low CV (<30%) → metrics are consistent → use 3 formulas
        # High CV (>30%) → metrics vary by geography → use 9 formulas
        use_9_formulas = spread_cv > 30

        return {
            "success": True,
            "recommendation": "9_formulas" if use_9_formulas else "3_formulas",
            "reasoning": (
                f"Spread varies significantly across geography levels (CV={spread_cv:.1f}%). "
                "Different geographies need different formulas."
                if use_9_formulas
                else f"Spreads are consistent across geography levels (CV={spread_cv:.1f}%). "
                "One formula per score type is sufficient."
            ),
            "spread_consistency": {
                "coefficient_of_variation": round(spread_cv, 2),
                "mean_spread": round(spread_mean, 4),
                "std_spread": round(spread_std, 4)
            },
            "results_by_geography": results_by_geo,
            "horizon_months": request.horizon_months
        }
    except Exception as e:
        logger.exception("Formula comparison failed")
        raise HTTPException(status_code=500, detail=str(e))
