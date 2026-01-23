"""
Find Optimal Weights using AutoGluon

Uses AutoGluon to:
- Train ML models predicting excess returns
- Calculate feature importance
- Compare to current formula weights
- Output suggested weight adjustments

Outputs:
- feature_importance_YYYYMMDD.csv
- models/autogluon_YYYYMMDD/ (saved model)

Usage:
    python find_optimal_weights.py
    python find_optimal_weights.py --target composite_excess_1y
    python find_optimal_weights.py --time-limit 600  # 10 minutes
"""

import os
import sys
import argparse
from datetime import datetime
import pandas as pd
import numpy as np

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import report_progress, get_output_dir, get_models_dir

# Feature columns used in scoring formula
FORMULA_FEATURES = [
    'zhvi_yoy',           # Price momentum
    'zori_yoy',           # Rent momentum
    'pending_ratio',      # Market demand
    'inventory',          # Supply
    'days_on_market',     # Market speed
    'median_household_income',  # Economic strength
    'population',         # Market size
    'vacancy_rate',       # Housing availability
    'owner_occupied_pct', # Ownership stability
]

# Current formula weights (for comparison)
CURRENT_WEIGHTS = {
    'zhvi_yoy': 0.15,
    'zori_yoy': 0.10,
    'pending_ratio': 0.20,
    'inventory': -0.10,
    'days_on_market': -0.15,
    'median_household_income': 0.15,
    'population': 0.05,
    'vacancy_rate': -0.05,
    'owner_occupied_pct': 0.05,
}


def load_benchmark_data() -> pd.DataFrame:
    """Load the backtest data with benchmarks."""
    filepath = os.path.join(get_output_dir(), 'backtest_with_benchmarks.parquet')
    if not os.path.exists(filepath):
        raise FileNotFoundError(
            f"Benchmark data not found: {filepath}. Run calculate_benchmarks.py first."
        )
    return pd.read_parquet(filepath)


def prepare_training_data(df: pd.DataFrame, target: str, sample_size: int = None) -> tuple[pd.DataFrame, pd.Series]:
    """
    Prepare training data for AutoGluon.

    Args:
        df: Input DataFrame
        target: Target column name
        sample_size: Optional max sample size for memory efficiency

    Returns:
        X: Feature DataFrame
        y: Target Series
    """
    report_progress(15, "Preparing training data...")

    # Select features that exist in the data
    available_features = [f for f in FORMULA_FEATURES if f in df.columns]
    missing_features = [f for f in FORMULA_FEATURES if f not in df.columns]

    if missing_features:
        print(f"  Warning: Missing features: {missing_features}")

    # Filter to rows with valid target
    valid_mask = df[target].notna()
    df_valid = df[valid_mask].copy()

    # Sample if dataset is too large for memory
    if sample_size and len(df_valid) > sample_size:
        print(f"  Sampling {sample_size:,} from {len(df_valid):,} rows for memory efficiency")
        df_valid = df_valid.sample(n=sample_size, random_state=42)

    print(f"  Training samples: {len(df_valid):,} (from {len(df):,} total)")
    print(f"  Features: {len(available_features)}")

    X = df_valid[available_features].copy()
    y = df_valid[target].copy()

    # Handle missing values in features
    for col in X.columns:
        if X[col].isna().any():
            median_val = X[col].median()
            X.loc[:, col] = X[col].fillna(median_val)
            print(f"    Filled {col} NaNs with median: {median_val:.4f}")

    return X, y


def train_autogluon_model(
    X: pd.DataFrame,
    y: pd.Series,
    time_limit: int = 300,
    model_name: str = None
) -> tuple:
    """
    Train AutoGluon model and get feature importance.

    Returns:
        predictor: Trained AutoGluon predictor
        importance_df: DataFrame with feature importance
    """
    try:
        from autogluon.tabular import TabularPredictor
    except ImportError:
        raise ImportError(
            "AutoGluon not installed. Install with: pip install autogluon"
        )

    report_progress(25, "Training AutoGluon model...")

    # Combine features and target
    train_data = X.copy()
    train_data['target'] = y

    # Set up model save path
    if model_name is None:
        model_name = f"autogluon_{datetime.now().strftime('%Y%m%d')}"

    model_path = os.path.join(get_models_dir(), model_name)
    os.makedirs(model_path, exist_ok=True)

    # Train with AutoGluon
    predictor = TabularPredictor(
        label='target',
        path=model_path,
        eval_metric='r2',
        verbosity=1
    )

    predictor.fit(
        train_data,
        time_limit=time_limit,
        presets='medium_quality',  # Faster and less memory intensive
        excluded_model_types=['KNN', 'NN_TORCH', 'FASTAI'],  # Skip slow/heavy models
        num_cpus=4,
        num_gpus=0,  # Disable GPU to avoid memory issues
        ag_args_fit={'ag.max_memory_usage_ratio': 0.8},
    )

    report_progress(70, "Calculating feature importance...")

    # Get feature importance
    importance = predictor.feature_importance(train_data)

    # Convert to DataFrame
    importance_df = pd.DataFrame({
        'feature': importance.index,
        'importance': importance['importance'].values,
        'stddev': importance['stddev'].values if 'stddev' in importance.columns else 0,
        'p_value': importance['p_value'].values if 'p_value' in importance.columns else np.nan,
    })

    # Sort by importance
    importance_df = importance_df.sort_values('importance', ascending=False)

    # Add current weights for comparison
    importance_df['current_weight'] = importance_df['feature'].map(CURRENT_WEIGHTS)

    # Normalize importance to sum to 1 (like weights)
    total_importance = importance_df['importance'].abs().sum()
    importance_df['suggested_weight'] = importance_df['importance'] / total_importance

    print(f"\n  Model path: {model_path}")
    try:
        best_model = predictor.model_best if hasattr(predictor, 'model_best') else predictor.get_model_best()
    except (AttributeError, Exception):
        best_model = "Unknown"
    print(f"  Best model: {best_model}")
    print(f"  Leaderboard:")
    try:
        print(predictor.leaderboard().head(5).to_string())
    except Exception as e:
        print(f"  Could not display leaderboard: {e}")

    return predictor, importance_df


def compare_weights(importance_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compare current formula weights to ML-suggested weights.
    """
    report_progress(85, "Comparing weights...")

    comparison = importance_df[['feature', 'importance', 'current_weight', 'suggested_weight']].copy()

    # Calculate difference
    comparison['weight_diff'] = comparison['suggested_weight'] - comparison['current_weight'].fillna(0)

    # Add recommendation
    def get_recommendation(row):
        if pd.isna(row['current_weight']):
            return "ADD" if abs(row['suggested_weight']) > 0.05 else "IGNORE"
        diff = row['weight_diff']
        if abs(diff) < 0.02:
            return "KEEP"
        elif diff > 0:
            return "INCREASE"
        else:
            return "DECREASE"

    comparison['recommendation'] = comparison.apply(get_recommendation, axis=1)

    return comparison


def main():
    """Main weight optimization."""
    parser = argparse.ArgumentParser(description='Find optimal formula weights using AutoGluon')
    parser.add_argument('--target', type=str, default='composite_excess_1y',
                        help='Target variable to predict')
    parser.add_argument('--time-limit', type=int, default=300,
                        help='Training time limit in seconds')
    parser.add_argument('--sample-size', type=int, default=100000,
                        help='Max sample size for training (default: 100000)')
    args = parser.parse_args()

    print("=" * 60)
    print("PropertyIQ ML - Find Optimal Weights")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Target: {args.target}")
    print(f"Time limit: {args.time_limit}s")
    print(f"Sample size: {args.sample_size:,}")
    print("=" * 60)

    report_progress(0, "Loading benchmark data...")

    # Load data
    df = load_benchmark_data()
    print(f"  Loaded {len(df):,} records with benchmarks")

    # Prepare training data
    X, y = prepare_training_data(df, args.target, sample_size=args.sample_size)

    # Train model
    predictor, importance_df = train_autogluon_model(
        X, y,
        time_limit=args.time_limit
    )

    # Compare weights
    comparison_df = compare_weights(importance_df)

    report_progress(90, "Saving outputs...")

    # Save feature importance
    output_dir = get_output_dir()
    date_str = datetime.now().strftime('%Y%m%d')
    importance_path = os.path.join(output_dir, f'feature_importance_{date_str}.csv')
    comparison_df.to_csv(importance_path, index=False)
    print(f"  Saved: {importance_path}")

    report_progress(100, "Complete!")

    print("\n" + "=" * 60)
    print("Weight Comparison:")
    print("=" * 60)
    print(comparison_df.to_string(index=False))
    print("\n" + "=" * 60)
    print("Recommendations:")
    for _, row in comparison_df.iterrows():
        if row['recommendation'] != 'KEEP':
            print(f"  {row['recommendation']}: {row['feature']} "
                  f"({row['current_weight']:.2f} -> {row['suggested_weight']:.2f})")
    print("=" * 60)


if __name__ == '__main__':
    main()
