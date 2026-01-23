"""
Generate SHAP Explanations

Generates human-readable explanations for WHY a score is what it is using SHAP values.

Output per geography:
{
    "geography_id": "60601",
    "predicted_excess_return": 0.034,
    "base_value": 0.0,
    "contributions": [
        {"feature": "pending_ratio", "value": 0.42, "contribution": +8.2, "direction": "positive"},
        {"feature": "median_income", "value": 85000, "contribution": +6.1, "direction": "positive"},
        {"feature": "zhvi_yoy", "value": -0.02, "contribution": -3.4, "direction": "negative"}
    ],
    "explanation_text": "This area is predicted to OUTPERFORM..."
}

Usage:
    python generate_shap_explanations.py                      # Sample of geographies
    python generate_shap_explanations.py --geography-id 60601 # Single geography
    python generate_shap_explanations.py --batch              # All geographies
    python generate_shap_explanations.py --top 100            # Top 100 by score
"""

import os
import sys
import json
import argparse
from datetime import datetime
from typing import Optional
import pandas as pd
import numpy as np

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import report_progress, get_output_dir, get_models_dir


# Feature display names
FEATURE_DISPLAY_NAMES = {
    'zhvi_yoy': 'Price momentum',
    'zori_yoy': 'Rent momentum',
    'pending_ratio': 'Pending sales ratio',
    'inventory': 'Housing inventory',
    'days_on_market': 'Days on market',
    'median_household_income': 'Median income',
    'population': 'Population',
    'vacancy_rate': 'Vacancy rate',
    'owner_occupied_pct': 'Owner-occupied %',
}


def load_model():
    """Load the most recent AutoGluon model."""
    try:
        from autogluon.tabular import TabularPredictor
    except ImportError:
        raise ImportError("AutoGluon not installed. Install with: pip install autogluon")

    models_dir = get_models_dir()

    # Find most recent model
    model_dirs = [d for d in os.listdir(models_dir) if d.startswith('autogluon_')]
    if not model_dirs:
        raise FileNotFoundError(
            f"No AutoGluon models found in {models_dir}. Run find_optimal_weights.py first."
        )

    latest_model = sorted(model_dirs)[-1]
    model_path = os.path.join(models_dir, latest_model)

    print(f"  Loading model: {model_path}")
    predictor = TabularPredictor.load(model_path)

    return predictor


def load_latest_data() -> pd.DataFrame:
    """Load the most recent backtest data for explanations."""
    filepath = os.path.join(get_output_dir(), 'backtest_with_benchmarks.parquet')
    if not os.path.exists(filepath):
        raise FileNotFoundError(
            f"Benchmark data not found: {filepath}. Run calculate_benchmarks.py first."
        )

    df = pd.read_parquet(filepath)

    # Get most recent date
    df['date'] = pd.to_datetime(df['date'])
    latest_date = df['date'].max()

    print(f"  Using data from: {latest_date.strftime('%Y-%m-%d')}")
    return df[df['date'] == latest_date].copy()


def calculate_shap_values(predictor, X: pd.DataFrame) -> tuple:
    """
    Calculate SHAP values for given features.

    Returns:
        shap_values: numpy array of SHAP values
        expected_value: base prediction value
    """
    try:
        import shap
    except ImportError:
        raise ImportError("SHAP not installed. Install with: pip install shap")

    report_progress(30, "Calculating SHAP values...")

    # Get the best model from predictor
    best_model = predictor.model_best if hasattr(predictor, 'model_best') else predictor.get_model_best()

    # Create SHAP explainer
    # Use TreeExplainer for tree-based models, KernelExplainer as fallback
    try:
        model = predictor._learner.load_model(best_model)
        if hasattr(model, 'model'):
            # For wrapped models
            explainer = shap.TreeExplainer(model.model)
        else:
            explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X)
        expected_value = explainer.expected_value
    except Exception as e:
        print(f"  TreeExplainer failed ({e}), using KernelExplainer...")
        # Fallback to KernelExplainer (slower but works with any model)
        background = shap.sample(X, min(100, len(X)))
        explainer = shap.KernelExplainer(
            lambda x: predictor.predict(pd.DataFrame(x, columns=X.columns)),
            background
        )
        shap_values = explainer.shap_values(X)
        expected_value = explainer.expected_value

    return shap_values, expected_value


def generate_explanation(
    geography_id: str,
    features: pd.Series,
    shap_values: np.ndarray,
    expected_value: float,
    prediction: float
) -> dict:
    """
    Generate a single geography explanation.
    """
    # Sort contributions by absolute value
    contributions = []
    for i, (feature, value) in enumerate(features.items()):
        contribution = shap_values[i]
        contributions.append({
            'feature': feature,
            'display_name': FEATURE_DISPLAY_NAMES.get(feature, feature),
            'value': float(value) if pd.notna(value) else None,
            'contribution': float(contribution),
            'direction': 'positive' if contribution > 0 else 'negative'
        })

    # Sort by absolute contribution
    contributions.sort(key=lambda x: abs(x['contribution']), reverse=True)

    # Generate explanation text
    top_positive = [c for c in contributions if c['contribution'] > 0][:3]
    top_negative = [c for c in contributions if c['contribution'] < 0][:3]

    if prediction > 0.02:
        outlook = "OUTPERFORM"
    elif prediction < -0.02:
        outlook = "UNDERPERFORM"
    else:
        outlook = "perform near AVERAGE"

    strengths = ", ".join([c['display_name'] for c in top_positive]) if top_positive else "none identified"
    concerns = ", ".join([c['display_name'] for c in top_negative]) if top_negative else "none identified"

    explanation_text = (
        f"This area is predicted to {outlook}. "
        f"Strengths: {strengths}. "
        f"Concerns: {concerns}."
    )

    return {
        'geography_id': geography_id,
        'predicted_excess_return': float(prediction),
        'base_value': float(expected_value),
        'contributions': contributions,
        'explanation_text': explanation_text,
        'generated_at': datetime.now().isoformat(),
    }


def main():
    """Main SHAP explanation generation."""
    parser = argparse.ArgumentParser(description='Generate SHAP explanations for PropertyIQ scores')
    parser.add_argument('--geography-id', type=str, default=None,
                        help='Single geography ID to explain')
    parser.add_argument('--batch', action='store_true',
                        help='Generate explanations for all geographies')
    parser.add_argument('--top', type=int, default=None,
                        help='Generate explanations for top N geographies by score')
    parser.add_argument('--sample', type=int, default=50,
                        help='Sample size if not batch (default: 50)')
    args = parser.parse_args()

    print("=" * 60)
    print("PropertyIQ ML - Generate SHAP Explanations")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    report_progress(0, "Loading model and data...")

    # Load model and data
    predictor = load_model()
    df = load_latest_data()

    print(f"  Loaded {len(df):,} geography records")

    # Select geographies to explain
    if args.geography_id:
        df = df[df['geography_id'] == args.geography_id]
        if len(df) == 0:
            raise ValueError(f"Geography ID not found: {args.geography_id}")
    elif args.top:
        df = df.nlargest(args.top, 'composite_excess_1y')
    elif not args.batch:
        df = df.sample(min(args.sample, len(df)))

    print(f"  Explaining {len(df):,} geographies")

    report_progress(10, "Preparing features...")

    # Get feature columns
    feature_cols = [c for c in predictor.feature_metadata_in.get_features() if c in df.columns]
    X = df[feature_cols].copy()

    # Handle missing values
    for col in X.columns:
        if X[col].isna().any():
            X[col] = X[col].fillna(X[col].median())

    # Get predictions
    report_progress(20, "Getting predictions...")
    predictions = predictor.predict(X)

    # Calculate SHAP values
    shap_values, expected_value = calculate_shap_values(predictor, X)

    report_progress(60, "Generating explanations...")

    # Generate explanations
    explanations = []
    for i, (idx, row) in enumerate(df.iterrows()):
        if i % 100 == 0:
            progress = 60 + int((i / len(df)) * 35)
            report_progress(progress, f"Processing geography {i+1}/{len(df)}...")

        geo_id = row['geography_id']
        features = X.iloc[i] if isinstance(X, pd.DataFrame) else X[i]
        shap_vals = shap_values[i] if isinstance(shap_values, np.ndarray) else shap_values

        explanation = generate_explanation(
            geography_id=str(geo_id),
            features=features,
            shap_values=shap_vals,
            expected_value=expected_value if isinstance(expected_value, float) else expected_value[0],
            prediction=predictions.iloc[i] if hasattr(predictions, 'iloc') else predictions[i]
        )
        explanations.append(explanation)

    report_progress(95, "Saving output...")

    # Save explanations
    output_dir = get_output_dir()
    date_str = datetime.now().strftime('%Y%m%d')
    output_path = os.path.join(output_dir, f'explanations_{date_str}.json')

    with open(output_path, 'w') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'model_used': str(predictor.path),
            'num_explanations': len(explanations),
            'explanations': explanations
        }, f, indent=2)

    print(f"  Saved: {output_path}")

    report_progress(100, "Complete!")

    print("\n" + "=" * 60)
    print("Sample Explanations:")
    print("=" * 60)
    for exp in explanations[:3]:
        print(f"\nGeography: {exp['geography_id']}")
        print(f"  Predicted excess return: {exp['predicted_excess_return']:.2f}%")
        print(f"  {exp['explanation_text']}")
        print("  Top contributors:")
        for c in exp['contributions'][:5]:
            print(f"    {c['display_name']}: {c['contribution']:+.2f}")
    print("=" * 60)


if __name__ == '__main__':
    main()
