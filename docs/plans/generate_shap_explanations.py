# scripts/generate_shap_explanations.py
"""
Generate SHAP explanations for PropertyIQ scores.

SHAP (SHapley Additive exPlanations) tells users WHY a score is what it is:
"Your HomeReady score is 72 because:
 + Strong pending ratio: +8 points
 + Good affordability: +6 points
 + Low unemployment: +4 points
 - High price volatility: -3 points
 - Rising inventory: -2 points
 = Base (50) + Adjustments (22) = 72"

This builds trust by making scores transparent and explainable.

Usage: 
    # Generate explanations for all geographies
    python scripts/generate_shap_explanations.py
    
    # Generate for specific geography
    python scripts/generate_shap_explanations.py --geography_id 60601
"""

import polars as pl
import pandas as pd
import numpy as np
import shap
import json
import os
from datetime import datetime
from autogluon.tabular import TabularPredictor
import argparse
from tqdm import tqdm
import plotly.graph_objects as go
from plotly.subplots import make_subplots


def load_model_and_data():
    """Load the trained AutoGluon model and data."""
    
    # Find most recent model
    model_dirs = [d for d in os.listdir("models") if d.startswith("autogluon_")]
    if not model_dirs:
        raise FileNotFoundError("No AutoGluon model found. Run find_optimal_weights.py first.")
    
    latest_model = sorted(model_dirs)[-1]
    model_path = f"models/{latest_model}"
    
    print(f"Loading model from: {model_path}")
    predictor = TabularPredictor.load(model_path)
    
    # Load data
    df = pl.read_parquet("data/backtest_with_benchmarks.parquet")
    
    return predictor, df


def get_feature_columns():
    """Get the list of features used in the model."""
    return [
        'zhvi', 'zori', 'zhvi_yoy', 'zori_yoy',
        'median_dom', 'inventory', 'pending_ratio',
        'median_income', 'unemployment_rate', 'poverty_rate',
        'homeownership_rate', 'college_rate', 'population_density',
    ]


def create_shap_explainer(predictor, sample_data: pd.DataFrame):
    """Create a SHAP explainer for the model."""
    
    # Get the best model from AutoGluon
    best_model_name = predictor.get_model_best()
    
    # AutoGluon models need a wrapper for SHAP
    def model_predict(X):
        return predictor.predict(X, model=best_model_name)
    
    # Use KernelExplainer (works with any model)
    # Sample background data for efficiency
    background = shap.sample(sample_data, 100)
    
    explainer = shap.KernelExplainer(model_predict, background)
    
    return explainer


def generate_explanation_for_geography(
    geography_id: str,
    predictor,
    df: pl.DataFrame,
    explainer=None,
    feature_cols=None
) -> dict:
    """
    Generate SHAP explanation for a single geography.
    
    Returns a dictionary with:
    - geography_id
    - predicted_score
    - base_value (expected score for average geography)
    - contributions: list of {feature, value, contribution, direction}
    - explanation_text: human-readable explanation
    """
    
    if feature_cols is None:
        feature_cols = get_feature_columns()
    
    # Get the geography's data (most recent score date)
    geo_data = df.filter(
        pl.col("geography_id") == geography_id
    ).sort("score_date", descending=True).head(1)
    
    if len(geo_data) == 0:
        return {"error": f"Geography {geography_id} not found"}
    
    # Convert to pandas for SHAP
    geo_pd = geo_data.select(feature_cols).to_pandas()
    
    # If no explainer provided, create a simple one
    if explainer is None:
        # Use feature importance as proxy for contribution
        # (This is a simplified version - real SHAP is more accurate)
        importance = predictor.feature_importance(geo_pd)
        
        contributions = []
        for feature in feature_cols:
            if feature in importance.index:
                value = geo_pd[feature].iloc[0]
                imp = importance.loc[feature, 'importance']
                
                # Estimate contribution direction based on value vs median
                median_val = df.select(pl.col(feature).median()).item()
                if pd.notna(value) and pd.notna(median_val):
                    # Positive contribution if value is "good" direction
                    direction = "positive" if value > median_val else "negative"
                    contribution = imp * (1 if direction == "positive" else -1) * 10
                else:
                    direction = "neutral"
                    contribution = 0
                
                contributions.append({
                    "feature": feature,
                    "value": float(value) if pd.notna(value) else None,
                    "importance": float(imp),
                    "contribution": float(contribution),
                    "direction": direction
                })
        
        # Sort by absolute contribution
        contributions.sort(key=lambda x: abs(x["contribution"]), reverse=True)
        
        # Calculate predicted score
        predicted = predictor.predict(geo_pd).iloc[0]
        
        return {
            "geography_id": geography_id,
            "predicted_excess_return": float(predicted),
            "base_value": 0.0,  # Excess return baseline
            "contributions": contributions[:10],  # Top 10
            "explanation_text": generate_explanation_text(contributions[:5], predicted),
            "generated_at": datetime.now().isoformat()
        }
    
    else:
        # Use actual SHAP values
        shap_values = explainer.shap_values(geo_pd)
        
        contributions = []
        for i, feature in enumerate(feature_cols):
            contributions.append({
                "feature": feature,
                "value": float(geo_pd[feature].iloc[0]) if pd.notna(geo_pd[feature].iloc[0]) else None,
                "shap_value": float(shap_values[0][i]),
                "contribution": float(shap_values[0][i]) * 100,  # Scale for readability
                "direction": "positive" if shap_values[0][i] > 0 else "negative"
            })
        
        # Sort by absolute SHAP value
        contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        
        predicted = predictor.predict(geo_pd).iloc[0]
        base_value = explainer.expected_value
        
        return {
            "geography_id": geography_id,
            "predicted_excess_return": float(predicted),
            "base_value": float(base_value),
            "contributions": contributions[:10],
            "explanation_text": generate_explanation_text(contributions[:5], predicted),
            "generated_at": datetime.now().isoformat()
        }


def generate_explanation_text(contributions: list, predicted: float) -> str:
    """Generate human-readable explanation text."""
    
    # Feature name mappings for readability
    feature_names = {
        'zhvi': 'home values',
        'zori': 'rental rates',
        'zhvi_yoy': 'price momentum',
        'zori_yoy': 'rent growth',
        'median_dom': 'days on market',
        'inventory': 'inventory levels',
        'pending_ratio': 'pending sales ratio',
        'median_income': 'household income',
        'unemployment_rate': 'unemployment',
        'poverty_rate': 'poverty rate',
        'homeownership_rate': 'homeownership',
        'college_rate': 'education levels',
        'population_density': 'population density',
    }
    
    positive_factors = [c for c in contributions if c["direction"] == "positive"]
    negative_factors = [c for c in contributions if c["direction"] == "negative"]
    
    text_parts = []
    
    if predicted > 0.02:
        text_parts.append("This area is predicted to OUTPERFORM the market.")
    elif predicted < -0.02:
        text_parts.append("This area is predicted to UNDERPERFORM the market.")
    else:
        text_parts.append("This area is predicted to perform near market average.")
    
    if positive_factors:
        pos_names = [feature_names.get(f["feature"], f["feature"]) for f in positive_factors[:3]]
        text_parts.append(f"Strengths: {', '.join(pos_names)}.")
    
    if negative_factors:
        neg_names = [feature_names.get(f["feature"], f["feature"]) for f in negative_factors[:3]]
        text_parts.append(f"Concerns: {', '.join(neg_names)}.")
    
    return " ".join(text_parts)


def generate_explanation_chart(explanation: dict) -> go.Figure:
    """Generate a waterfall chart showing score contributions."""
    
    contributions = explanation["contributions"]
    
    # Prepare data for waterfall
    features = [c["feature"] for c in contributions]
    values = [c["contribution"] for c in contributions]
    
    # Feature name mappings
    feature_labels = {
        'zhvi': 'Home Values',
        'zori': 'Rental Rates',
        'zhvi_yoy': 'Price Momentum',
        'zori_yoy': 'Rent Growth',
        'median_dom': 'Days on Market',
        'inventory': 'Inventory',
        'pending_ratio': 'Pending Sales',
        'median_income': 'Income',
        'unemployment_rate': 'Unemployment',
        'poverty_rate': 'Poverty Rate',
        'homeownership_rate': 'Homeownership',
        'college_rate': 'Education',
        'population_density': 'Density',
    }
    
    labels = [feature_labels.get(f, f) for f in features]
    
    # Create waterfall chart
    fig = go.Figure(go.Waterfall(
        name="Score Contribution",
        orientation="h",
        measure=["relative"] * len(values),
        y=labels,
        x=values,
        connector={"line": {"color": "rgb(63, 63, 63)"}},
        increasing={"marker": {"color": "#22c55e"}},  # Green
        decreasing={"marker": {"color": "#ef4444"}},  # Red
        textposition="outside",
        text=[f"{v:+.1f}" for v in values],
    ))
    
    fig.update_layout(
        title=f"Score Explanation for {explanation['geography_id']}",
        showlegend=False,
        height=400,
        xaxis_title="Contribution to Predicted Excess Return (%)",
        yaxis=dict(autorange="reversed"),
    )
    
    return fig


def batch_generate_explanations(
    geography_ids: list,
    predictor,
    df: pl.DataFrame,
    output_dir: str = "data/explanations"
) -> dict:
    """Generate explanations for multiple geographies."""
    
    os.makedirs(output_dir, exist_ok=True)
    
    feature_cols = get_feature_columns()
    explanations = {}
    
    print(f"\nGenerating explanations for {len(geography_ids)} geographies...")
    
    for geo_id in tqdm(geography_ids):
        try:
            explanation = generate_explanation_for_geography(
                geography_id=geo_id,
                predictor=predictor,
                df=df,
                feature_cols=feature_cols
            )
            explanations[geo_id] = explanation
        except Exception as e:
            explanations[geo_id] = {"error": str(e)}
    
    # Save to JSON
    output_path = f"{output_dir}/explanations_{datetime.now().strftime('%Y%m%d')}.json"
    with open(output_path, 'w') as f:
        json.dump(explanations, f, indent=2)
    
    print(f"\nSaved explanations to: {output_path}")
    
    return explanations


def generate_sample_explanations():
    """Generate explanations for a sample of geographies."""
    
    print("=" * 70)
    print("SHAP EXPLANATION GENERATOR")
    print("=" * 70)
    
    # Load model and data
    predictor, df = load_model_and_data()
    
    # Get sample of geographies (top metros)
    sample_geos = (
        df
        .filter(pl.col("geography_type") == "metro")
        .select("geography_id")
        .unique()
        .head(50)
        .to_series()
        .to_list()
    )
    
    print(f"\nGenerating explanations for {len(sample_geos)} metros...")
    
    # Generate explanations
    explanations = batch_generate_explanations(
        geography_ids=sample_geos,
        predictor=predictor,
        df=df
    )
    
    # Show example
    example_id = sample_geos[0]
    example = explanations[example_id]
    
    print("\n" + "=" * 70)
    print(f"EXAMPLE EXPLANATION: {example_id}")
    print("=" * 70)
    
    if "error" not in example:
        print(f"\nPredicted Excess Return: {example['predicted_excess_return']:.2%}")
        print(f"\n{example['explanation_text']}")
        print("\nTop Contributing Factors:")
        for c in example['contributions'][:5]:
            direction = "↑" if c['direction'] == 'positive' else "↓"
            print(f"  {direction} {c['feature']}: {c['contribution']:+.2f}")
    else:
        print(f"Error: {example['error']}")
    
    return explanations


def main():
    """Main entry point with CLI arguments."""
    
    parser = argparse.ArgumentParser(description='Generate SHAP explanations for PropertyIQ scores')
    parser.add_argument('--geography_id', type=str, help='Specific geography ID to explain')
    parser.add_argument('--batch', action='store_true', help='Generate for all geographies')
    parser.add_argument('--sample', action='store_true', help='Generate for sample of geographies')
    
    args = parser.parse_args()
    
    if args.geography_id:
        # Single geography
        predictor, df = load_model_and_data()
        explanation = generate_explanation_for_geography(
            geography_id=args.geography_id,
            predictor=predictor,
            df=df
        )
        print(json.dumps(explanation, indent=2))
        
    elif args.batch:
        # All geographies
        predictor, df = load_model_and_data()
        all_geos = df.select("geography_id").unique().to_series().to_list()
        batch_generate_explanations(all_geos, predictor, df)
        
    else:
        # Sample (default)
        generate_sample_explanations()


if __name__ == "__main__":
    main()
