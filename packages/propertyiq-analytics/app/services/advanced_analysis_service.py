"""
Advanced Analysis Service

Provides ML-powered analysis tools for the Analytics Assistant:
- Regression analysis (OLS, Ridge)
- Feature importance (Random Forest)
- Market clustering (K-means)
- Weight optimization (Grid search)
- Visualization generation (Plotly)
"""

import logging
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
import json
import base64
from io import BytesIO

import pandas as pd
import numpy as np
from scipy import stats
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge, LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.model_selection import cross_val_score
from sklearn.metrics import r2_score, mean_absolute_error
import statsmodels.api as sm

try:
    import plotly.express as px
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    PLOTLY_AVAILABLE = True
except ImportError:
    PLOTLY_AVAILABLE = False

from app.services.data_cache import get_data_cache

logger = logging.getLogger(__name__)


@dataclass
class RegressionResult:
    """Result of a regression analysis."""
    success: bool
    model_type: str
    target_variable: str
    r_squared: float
    adj_r_squared: Optional[float]
    mae: float
    coefficients: Dict[str, float]
    p_values: Optional[Dict[str, float]]
    feature_rankings: List[Dict[str, Any]]
    sample_size: int
    error: Optional[str] = None


@dataclass
class FeatureImportanceResult:
    """Result of feature importance analysis."""
    success: bool
    method: str
    target_variable: str
    importances: List[Dict[str, Any]]
    r_squared: float
    sample_size: int
    error: Optional[str] = None


@dataclass
class ClusterResult:
    """Result of market clustering."""
    success: bool
    n_clusters: int
    cluster_summary: List[Dict[str, Any]]
    market_assignments: List[Dict[str, Any]]
    silhouette_score: float
    inertia: float
    error: Optional[str] = None


@dataclass
class OptimizationResult:
    """Result of weight optimization."""
    success: bool
    optimal_weights: Dict[str, float]
    baseline_correlation: float
    optimized_correlation: float
    improvement_pct: float
    tested_combinations: int
    error: Optional[str] = None


@dataclass
class ChartResult:
    """Result of chart generation."""
    success: bool
    chart_type: str
    title: str
    html: Optional[str] = None
    image_base64: Optional[str] = None
    plotly_json: Optional[str] = None
    error: Optional[str] = None


class AdvancedAnalysisService:
    """Service for advanced ML and statistical analysis."""
    
    def __init__(self):
        self._cache = None
        logger.info("AdvancedAnalysisService initialized")
    
    @property
    def cache(self):
        if self._cache is None:
            self._cache = get_data_cache()
        return self._cache
    
    def _get_data(self, geography_type: str = 'metro') -> pd.DataFrame:
        """Get cached data for analysis."""
        df = self.cache.get_cached_data(geography_type, auto_sync=False)
        if df is None or len(df) == 0:
            raise ValueError(f"No cached data available for {geography_type}")
        return df
    
    def _get_feature_columns(self, df: pd.DataFrame) -> List[str]:
        """Get columns that can be used as features."""
        # Score component columns
        score_components = [
            'homeready_affordability', 'homeready_stability', 'homeready_value',
            'homeready_livability', 'homeready_momentum',
            'investoredge_cashflow', 'investoredge_growth', 'investoredge_demand',
            'investoredge_entrypoint', 'investoredge_risk'
        ]
        
        # Raw metric columns that might exist
        raw_metrics = [
            'zhvi', 'zhvi_yoy', 'zori', 'zori_yoy',
            'median_listing_price', 'median_days_on_market',
            'unemployment_rate', 'population', 'median_income',
            'grm', 'cap_rate_proxy', 'price_rent_ratio'
        ]
        
        # Return columns that exist in the dataframe
        available = [c for c in score_components + raw_metrics if c in df.columns]
        return available
    
    def run_regression(
        self,
        geography_type: str = 'metro',
        target: str = 'actual_appreciation_12m',
        features: Optional[List[str]] = None,
        model_type: str = 'ols',
        states: Optional[List[str]] = None
    ) -> RegressionResult:
        """
        Run regression analysis to find which features predict outcomes.
        
        Args:
            geography_type: Type of geography (metro, county, zip, state)
            target: Target variable (appreciation column)
            features: Feature columns to use (None = auto-detect)
            model_type: 'ols' for OLS, 'ridge' for Ridge regression
            states: Optional state filter
        
        Returns:
            RegressionResult with coefficients and feature rankings
        """
        try:
            df = self._get_data(geography_type)
            
            # Apply state filter if provided
            if states and 'parent_geography_id' in df.columns:
                df = df[df['parent_geography_id'].isin([s.upper() for s in states])]
            
            # Get most recent data per geography
            if 'period_date' in df.columns:
                df = df.sort_values('period_date', ascending=False)
                df = df.groupby('geography_id').first().reset_index()
            
            # Determine features
            if features is None:
                features = self._get_feature_columns(df)
            
            # Validate columns exist
            features = [f for f in features if f in df.columns]
            if target not in df.columns:
                return RegressionResult(
                    success=False, model_type=model_type, target_variable=target,
                    r_squared=0, adj_r_squared=None, mae=0, coefficients={},
                    p_values=None, feature_rankings=[], sample_size=0,
                    error=f"Target column '{target}' not found"
                )
            
            if len(features) == 0:
                return RegressionResult(
                    success=False, model_type=model_type, target_variable=target,
                    r_squared=0, adj_r_squared=None, mae=0, coefficients={},
                    p_values=None, feature_rankings=[], sample_size=0,
                    error="No valid feature columns found"
                )
            
            # Prepare data
            analysis_df = df[features + [target]].dropna()
            if len(analysis_df) < 30:
                return RegressionResult(
                    success=False, model_type=model_type, target_variable=target,
                    r_squared=0, adj_r_squared=None, mae=0, coefficients={},
                    p_values=None, feature_rankings=[], sample_size=len(analysis_df),
                    error=f"Insufficient data: {len(analysis_df)} records (need 30+)"
                )
            
            X = analysis_df[features]
            y = analysis_df[target]
            
            # Standardize features
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            X_scaled_df = pd.DataFrame(X_scaled, columns=features)
            
            # Run regression
            if model_type == 'ridge':
                model = Ridge(alpha=1.0)
                model.fit(X_scaled, y)
                y_pred = model.predict(X_scaled)
                r2 = r2_score(y, y_pred)
                mae = mean_absolute_error(y, y_pred)
                coefficients = dict(zip(features, model.coef_))
                p_values = None  # Ridge doesn't have p-values
                adj_r2 = None
            else:
                # OLS with statsmodels for p-values
                X_const = sm.add_constant(X_scaled_df)
                ols_model = sm.OLS(y, X_const).fit()
                r2 = ols_model.rsquared
                adj_r2 = ols_model.rsquared_adj
                mae = mean_absolute_error(y, ols_model.predict(X_const))
                coefficients = dict(zip(features, ols_model.params[1:]))  # Skip constant
                p_values = dict(zip(features, ols_model.pvalues[1:]))
            
            # Rank features by absolute coefficient value
            feature_rankings = sorted(
                [
                    {
                        'feature': f,
                        'coefficient': round(float(coefficients[f]), 6),
                        'abs_coefficient': round(abs(float(coefficients[f])), 6),
                        'p_value': round(float(p_values[f]), 4) if p_values else None,
                        'significant': p_values[f] < 0.05 if p_values else None,
                        'direction': 'positive' if coefficients[f] > 0 else 'negative'
                    }
                    for f in features
                ],
                key=lambda x: x['abs_coefficient'],
                reverse=True
            )
            
            logger.info(f"Regression complete: R²={r2:.4f}, {len(features)} features, {len(analysis_df)} samples")
            
            return RegressionResult(
                success=True,
                model_type=model_type,
                target_variable=target,
                r_squared=round(float(r2), 4),
                adj_r_squared=round(float(adj_r2), 4) if adj_r2 else None,
                mae=round(float(mae), 6),
                coefficients={k: round(float(v), 6) for k, v in coefficients.items()},
                p_values={k: round(float(v), 4) for k, v in p_values.items()} if p_values else None,
                feature_rankings=feature_rankings,
                sample_size=len(analysis_df)
            )
            
        except Exception as e:
            logger.error(f"Regression failed: {e}", exc_info=True)
            return RegressionResult(
                success=False, model_type=model_type, target_variable=target,
                r_squared=0, adj_r_squared=None, mae=0, coefficients={},
                p_values=None, feature_rankings=[], sample_size=0,
                error=str(e)
            )
    
    def get_feature_importance(
        self,
        geography_type: str = 'metro',
        target: str = 'actual_appreciation_12m',
        features: Optional[List[str]] = None,
        method: str = 'random_forest',
        states: Optional[List[str]] = None
    ) -> FeatureImportanceResult:
        """
        Calculate feature importance using tree-based methods.
        
        Args:
            geography_type: Type of geography
            target: Target variable
            features: Feature columns (None = auto-detect)
            method: 'random_forest' or 'gradient_boosting'
            states: Optional state filter
        
        Returns:
            FeatureImportanceResult with ranked features
        """
        try:
            df = self._get_data(geography_type)
            
            # Apply state filter
            if states and 'parent_geography_id' in df.columns:
                df = df[df['parent_geography_id'].isin([s.upper() for s in states])]
            
            # Get most recent data
            if 'period_date' in df.columns:
                df = df.sort_values('period_date', ascending=False)
                df = df.groupby('geography_id').first().reset_index()
            
            # Determine features
            if features is None:
                features = self._get_feature_columns(df)
            features = [f for f in features if f in df.columns]
            
            if target not in df.columns or len(features) == 0:
                return FeatureImportanceResult(
                    success=False, method=method, target_variable=target,
                    importances=[], r_squared=0, sample_size=0,
                    error="Invalid columns"
                )
            
            # Prepare data
            analysis_df = df[features + [target]].dropna()
            if len(analysis_df) < 30:
                return FeatureImportanceResult(
                    success=False, method=method, target_variable=target,
                    importances=[], r_squared=len(analysis_df), sample_size=0,
                    error=f"Insufficient data: {len(analysis_df)} records"
                )
            
            X = analysis_df[features]
            y = analysis_df[target]
            
            # Fit model
            if method == 'gradient_boosting':
                model = GradientBoostingRegressor(n_estimators=100, max_depth=5, random_state=42)
            else:
                model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
            
            model.fit(X, y)
            r2 = model.score(X, y)
            
            # Get importances
            importances = sorted(
                [
                    {
                        'feature': features[i],
                        'importance': round(float(model.feature_importances_[i]), 4),
                        'importance_pct': round(float(model.feature_importances_[i]) * 100, 2)
                    }
                    for i in range(len(features))
                ],
                key=lambda x: x['importance'],
                reverse=True
            )
            
            # Add cumulative importance
            cumulative = 0
            for item in importances:
                cumulative += item['importance']
                item['cumulative_importance'] = round(cumulative, 4)
            
            logger.info(f"Feature importance complete: R²={r2:.4f}, top feature={importances[0]['feature']}")
            
            return FeatureImportanceResult(
                success=True,
                method=method,
                target_variable=target,
                importances=importances,
                r_squared=round(float(r2), 4),
                sample_size=len(analysis_df)
            )
            
        except Exception as e:
            logger.error(f"Feature importance failed: {e}", exc_info=True)
            return FeatureImportanceResult(
                success=False, method=method, target_variable=target,
                importances=[], r_squared=0, sample_size=0, error=str(e)
            )
    
    def cluster_markets(
        self,
        geography_type: str = 'metro',
        features: Optional[List[str]] = None,
        n_clusters: int = 5,
        states: Optional[List[str]] = None
    ) -> ClusterResult:
        """
        Cluster markets into groups based on similarity.
        
        Args:
            geography_type: Type of geography
            features: Features to cluster on (None = auto)
            n_clusters: Number of clusters
            states: Optional state filter
        
        Returns:
            ClusterResult with cluster assignments and summaries
        """
        try:
            df = self._get_data(geography_type)
            
            # Apply state filter
            if states and 'parent_geography_id' in df.columns:
                df = df[df['parent_geography_id'].isin([s.upper() for s in states])]
            
            # Get most recent data
            if 'period_date' in df.columns:
                df = df.sort_values('period_date', ascending=False)
                df = df.groupby('geography_id').first().reset_index()
            
            # Determine features
            if features is None:
                features = self._get_feature_columns(df)
            features = [f for f in features if f in df.columns]
            
            if len(features) < 2:
                return ClusterResult(
                    success=False, n_clusters=n_clusters,
                    cluster_summary=[], market_assignments=[],
                    silhouette_score=0, inertia=0,
                    error="Need at least 2 features for clustering"
                )
            
            # Prepare data
            analysis_df = df[['geography_id', 'geography_name'] + features].dropna()
            if len(analysis_df) < n_clusters * 3:
                return ClusterResult(
                    success=False, n_clusters=n_clusters,
                    cluster_summary=[], market_assignments=[],
                    silhouette_score=0, inertia=0,
                    error=f"Insufficient data for {n_clusters} clusters"
                )
            
            X = analysis_df[features]
            
            # Standardize
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            # Cluster
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            clusters = kmeans.fit_predict(X_scaled)
            
            # Calculate silhouette score
            from sklearn.metrics import silhouette_score
            sil_score = silhouette_score(X_scaled, clusters)
            
            # Build cluster summary
            analysis_df['cluster'] = clusters
            cluster_summary = []
            
            for c in range(n_clusters):
                cluster_data = analysis_df[analysis_df['cluster'] == c]
                summary = {
                    'cluster': c,
                    'size': len(cluster_data),
                    'markets': cluster_data['geography_name'].tolist()[:10],  # Top 10
                }
                for feat in features:
                    summary[f'avg_{feat}'] = round(float(cluster_data[feat].mean()), 2)
                cluster_summary.append(summary)
            
            # Market assignments (top 50)
            market_assignments = [
                {
                    'geography_id': row['geography_id'],
                    'geography_name': row['geography_name'],
                    'cluster': int(row['cluster'])
                }
                for _, row in analysis_df.head(50).iterrows()
            ]
            
            logger.info(f"Clustering complete: {n_clusters} clusters, silhouette={sil_score:.3f}")
            
            return ClusterResult(
                success=True,
                n_clusters=n_clusters,
                cluster_summary=cluster_summary,
                market_assignments=market_assignments,
                silhouette_score=round(float(sil_score), 4),
                inertia=round(float(kmeans.inertia_), 2)
            )
            
        except Exception as e:
            logger.error(f"Clustering failed: {e}", exc_info=True)
            return ClusterResult(
                success=False, n_clusters=n_clusters,
                cluster_summary=[], market_assignments=[],
                silhouette_score=0, inertia=0, error=str(e)
            )
    
    def optimize_weights(
        self,
        geography_type: str = 'metro',
        score_type: str = 'investoredge',
        target: str = 'actual_appreciation_12m',
        states: Optional[List[str]] = None
    ) -> OptimizationResult:
        """
        Find optimal weights for score components to maximize correlation with outcomes.
        
        Args:
            geography_type: Type of geography
            score_type: 'investoredge' or 'homeready'
            target: Target variable to optimize for
            states: Optional state filter
        
        Returns:
            OptimizationResult with optimal weights
        """
        try:
            df = self._get_data(geography_type)
            
            # Apply state filter
            if states and 'parent_geography_id' in df.columns:
                df = df[df['parent_geography_id'].isin([s.upper() for s in states])]
            
            # Get most recent data
            if 'period_date' in df.columns:
                df = df.sort_values('period_date', ascending=False)
                df = df.groupby('geography_id').first().reset_index()
            
            # Get component columns
            if score_type == 'homeready':
                components = ['homeready_affordability', 'homeready_stability', 
                             'homeready_value', 'homeready_livability', 'homeready_momentum']
            else:
                components = ['investoredge_cashflow', 'investoredge_growth',
                             'investoredge_demand', 'investoredge_entrypoint', 'investoredge_risk']
            
            components = [c for c in components if c in df.columns]
            if len(components) == 0 or target not in df.columns:
                return OptimizationResult(
                    success=False, optimal_weights={},
                    baseline_correlation=0, optimized_correlation=0,
                    improvement_pct=0, tested_combinations=0,
                    error="Required columns not found"
                )
            
            # Prepare data
            analysis_df = df[components + [target]].dropna()
            if len(analysis_df) < 50:
                return OptimizationResult(
                    success=False, optimal_weights={},
                    baseline_correlation=0, optimized_correlation=0,
                    improvement_pct=0, tested_combinations=0,
                    error=f"Insufficient data: {len(analysis_df)} records"
                )
            
            y = analysis_df[target].values
            X = analysis_df[components].values
            
            # Baseline: equal weights
            baseline_score = X.mean(axis=1)
            baseline_corr = float(np.corrcoef(baseline_score, y)[0, 1])
            
            # Grid search over weights (simplified - weights sum to 1)
            best_corr = baseline_corr
            best_weights = {c: 1.0 / len(components) for c in components}
            tested = 0
            
            # Generate weight combinations
            weight_options = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35]
            n_components = len(components)
            
            # Use Ridge regression to find optimal weights
            ridge = Ridge(alpha=0.1, positive=True)  # Positive weights only
            ridge.fit(X, y)
            
            # Normalize weights to sum to 1
            raw_weights = ridge.coef_
            if raw_weights.sum() > 0:
                normalized_weights = raw_weights / raw_weights.sum()
            else:
                normalized_weights = np.ones(n_components) / n_components
            
            # Calculate optimized score
            optimized_score = (X * normalized_weights).sum(axis=1)
            optimized_corr = float(np.corrcoef(optimized_score, y)[0, 1])
            
            optimal_weights = {components[i]: round(float(normalized_weights[i]), 4) 
                              for i in range(n_components)}
            
            improvement = ((optimized_corr - baseline_corr) / abs(baseline_corr)) * 100 if baseline_corr != 0 else 0
            
            logger.info(f"Weight optimization: baseline corr={baseline_corr:.4f}, optimized={optimized_corr:.4f}")
            
            return OptimizationResult(
                success=True,
                optimal_weights=optimal_weights,
                baseline_correlation=round(baseline_corr, 4),
                optimized_correlation=round(optimized_corr, 4),
                improvement_pct=round(improvement, 2),
                tested_combinations=1  # Ridge finds optimal in one shot
            )
            
        except Exception as e:
            logger.error(f"Weight optimization failed: {e}", exc_info=True)
            return OptimizationResult(
                success=False, optimal_weights={},
                baseline_correlation=0, optimized_correlation=0,
                improvement_pct=0, tested_combinations=0, error=str(e)
            )
    
    def generate_chart(
        self,
        chart_type: str,
        geography_type: str = 'metro',
        x_column: Optional[str] = None,
        y_column: Optional[str] = None,
        color_column: Optional[str] = None,
        title: Optional[str] = None,
        states: Optional[List[str]] = None,
        limit: int = 100
    ) -> ChartResult:
        """
        Generate a Plotly chart.
        
        Args:
            chart_type: 'scatter', 'bar', 'histogram', 'box', 'heatmap'
            geography_type: Type of geography
            x_column: X-axis column
            y_column: Y-axis column
            color_column: Color grouping column
            title: Chart title
            states: State filter
            limit: Max data points
        
        Returns:
            ChartResult with chart data
        """
        if not PLOTLY_AVAILABLE:
            return ChartResult(
                success=False, chart_type=chart_type,
                title=title or "Chart", error="Plotly not available"
            )
        
        try:
            df = self._get_data(geography_type)
            
            # Apply state filter
            if states and 'parent_geography_id' in df.columns:
                df = df[df['parent_geography_id'].isin([s.upper() for s in states])]
            
            # Get most recent data
            if 'period_date' in df.columns:
                df = df.sort_values('period_date', ascending=False)
                df = df.groupby('geography_id').first().reset_index()
            
            # Limit data
            df = df.head(limit)
            
            # Set default columns based on chart type
            if chart_type == 'scatter':
                x_column = x_column or 'investoredge_score'
                y_column = y_column or 'actual_appreciation_12m'
                
                if x_column not in df.columns or y_column not in df.columns:
                    return ChartResult(
                        success=False, chart_type=chart_type,
                        title=title or "Chart",
                        error=f"Columns not found: {x_column}, {y_column}"
                    )
                
                fig = px.scatter(
                    df, x=x_column, y=y_column,
                    color=color_column if color_column and color_column in df.columns else None,
                    hover_data=['geography_name'] if 'geography_name' in df.columns else None,
                    title=title or f"{y_column} vs {x_column}",
                    trendline="ols"
                )
                
            elif chart_type == 'histogram':
                x_column = x_column or 'investoredge_score'
                if x_column not in df.columns:
                    return ChartResult(
                        success=False, chart_type=chart_type,
                        title=title or "Chart", error=f"Column not found: {x_column}"
                    )
                
                fig = px.histogram(
                    df, x=x_column, nbins=30,
                    title=title or f"Distribution of {x_column}"
                )
                
            elif chart_type == 'bar':
                # Top/bottom performers
                x_column = x_column or 'geography_name'
                y_column = y_column or 'investoredge_score'
                
                if y_column in df.columns:
                    df = df.nlargest(20, y_column)
                
                fig = px.bar(
                    df, x=x_column, y=y_column,
                    title=title or f"Top 20 by {y_column}",
                    color=y_column,
                    color_continuous_scale='RdYlGn'
                )
                
            elif chart_type == 'box':
                x_column = x_column or 'parent_geography_id'
                y_column = y_column or 'investoredge_score'
                
                fig = px.box(
                    df, x=x_column, y=y_column,
                    title=title or f"{y_column} by {x_column}"
                )
                
            else:
                return ChartResult(
                    success=False, chart_type=chart_type,
                    title=title or "Chart",
                    error=f"Unknown chart type: {chart_type}"
                )
            
            # Update layout
            fig.update_layout(
                template='plotly_white',
                font=dict(size=12),
                title_font_size=16
            )
            
            # Convert to JSON for frontend rendering
            plotly_json = fig.to_json()
            
            # Generate HTML
            html = fig.to_html(full_html=False, include_plotlyjs='cdn')
            
            logger.info(f"Generated {chart_type} chart with {len(df)} data points")
            
            return ChartResult(
                success=True,
                chart_type=chart_type,
                title=title or fig.layout.title.text or "Chart",
                html=html,
                plotly_json=plotly_json
            )
            
        except Exception as e:
            logger.error(f"Chart generation failed: {e}", exc_info=True)
            return ChartResult(
                success=False, chart_type=chart_type,
                title=title or "Chart", error=str(e)
            )


# Singleton
_advanced_service: Optional[AdvancedAnalysisService] = None

def get_advanced_service() -> AdvancedAnalysisService:
    """Get or create the advanced analysis service singleton."""
    global _advanced_service
    if _advanced_service is None:
        _advanced_service = AdvancedAnalysisService()
    return _advanced_service
