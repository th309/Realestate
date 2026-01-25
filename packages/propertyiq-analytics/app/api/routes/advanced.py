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
