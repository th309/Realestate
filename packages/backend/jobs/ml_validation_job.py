"""
ML Validation Job

Compares PropertyIQ formula-based scores against AutoGluon ML predictions
to identify improvement opportunities and suggest weight adjustments.

Usage:
    python ml_validation_job.py --config config.json
    python ml_validation_job.py --job-id <uuid>  # Resume from database
"""

import os
import sys
import json
import time
import argparse
import shutil
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict

import numpy as np
import pandas as pd
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# AutoGluon import (may take a few seconds)
try:
    from autogluon.tabular import TabularPredictor
    AUTOGLUON_AVAILABLE = True
except ImportError:
    print("Warning: AutoGluon not installed. Install with: pip install autogluon.tabular")
    AUTOGLUON_AVAILABLE = False


@dataclass
class MLValidationConfig:
    """Configuration for ML validation run."""
    score_type: str  # 'homeready', 'investoredge', 'market_health'
    geography_type: str  # 'metro', 'county', 'zip'
    horizon: str  # '6m', '1y', '3y', '5y'
    train_period_start: str
    train_period_end: str
    test_period_start: str
    test_period_end: str
    ml_preset: str = 'best_quality'  # 'medium_quality', 'best_quality', 'high_quality'
    time_limit_seconds: int = 300
    job_id: Optional[str] = None


@dataclass
class ValidationMetrics:
    """Metrics for comparing formula vs ML performance."""
    r2: float
    directional_accuracy: float
    mae: float
    rmse: float
    top_quintile_outcome: float
    bottom_quintile_outcome: float
    quintile_spread: float


# Score type to metrics mapping
SCORE_METRICS = {
    'homeready': [
        'income_gap_ratio', 'years_to_save', 'rent_as_pct_of_income',
        'price_reduced_share', 'median_days_on_market', 'months_of_supply',
        'pending_listing_count_yy', 'volatility_36m', 'active_listing_count_yy',
        'unemployment_rate', 'zhvi_5y_cagr', 'population_yoy',
        'median_household_income_yoy', 'homeownership_rate', 'median_age'
    ],
    'investoredge': [
        'cap_rate', 'grm', 'gross_yield', 'rent_to_price_ratio',
        'zori_yoy', 'pending_ratio', 'median_days_on_market', 'renter_share',
        'zhvi_5y_cagr', 'zhvi_yoy', 'population_yoy',
        'overvalued_pct', 'price_reduced_share', 'months_of_supply',
        'volatility_36m', 'unemployment_rate', 'inventory_surplus_pct',
        'large_multi_permits_yoy'
    ],
    'market_health': [
        'pending_ratio', 'median_days_on_market', 'hotness_score',
        'months_of_supply', 'active_listing_count_yy', 'new_listing_count_yy',
        'price_reduced_share', 'sale_to_list_ratio', 'zhvi_yoy',
        'unemployment_rate', 'employment_yoy'
    ]
}

# Outcome columns by horizon
OUTCOME_COLUMNS = {
    '6m': 'zhvi_6m_change',
    '1y': 'zhvi_1y_change',
    '3y': 'zhvi_3y_cagr',
    '5y': 'zhvi_5y_cagr'
}

# Current formula weights (simplified - would come from database in production)
FORMULA_WEIGHTS = {
    'homeready': {
        'income_gap_ratio': {'weight': 0.12, 'component': 'affordability'},
        'years_to_save': {'weight': 0.09, 'component': 'affordability'},
        'rent_as_pct_of_income': {'weight': 0.09, 'component': 'affordability'},
        'price_reduced_share': {'weight': 0.075, 'component': 'market_timing'},
        'median_days_on_market': {'weight': 0.0625, 'component': 'market_timing'},
        'months_of_supply': {'weight': 0.0625, 'component': 'market_timing'},
        'pending_listing_count_yy': {'weight': 0.05, 'component': 'market_timing'},
        'volatility_36m': {'weight': 0.08, 'component': 'stability'},
        'active_listing_count_yy': {'weight': 0.07, 'component': 'stability'},
        'unemployment_rate': {'weight': 0.05, 'component': 'stability'},
        'zhvi_5y_cagr': {'weight': 0.06, 'component': 'growth_potential'},
        'population_yoy': {'weight': 0.045, 'component': 'growth_potential'},
        'median_household_income_yoy': {'weight': 0.045, 'component': 'growth_potential'},
        'homeownership_rate': {'weight': 0.06, 'component': 'livability'},
        'median_age': {'weight': 0.04, 'component': 'livability'},
    },
    'investoredge': {
        'cap_rate': {'weight': 0.1225, 'component': 'cash_flow'},
        'grm': {'weight': 0.0875, 'component': 'cash_flow'},
        'gross_yield': {'weight': 0.0875, 'component': 'cash_flow'},
        'rent_to_price_ratio': {'weight': 0.0525, 'component': 'cash_flow'},
        'zori_yoy': {'weight': 0.07, 'component': 'rent_demand'},
        'pending_ratio': {'weight': 0.05, 'component': 'rent_demand'},
        'median_days_on_market': {'weight': 0.04, 'component': 'rent_demand'},
        'renter_share': {'weight': 0.04, 'component': 'rent_demand'},
        'zhvi_5y_cagr': {'weight': 0.08, 'component': 'appreciation'},
        'zhvi_yoy': {'weight': 0.06, 'component': 'appreciation'},
        'population_yoy': {'weight': 0.06, 'component': 'appreciation'},
        'overvalued_pct': {'weight': 0.06, 'component': 'entry_point'},
        'price_reduced_share': {'weight': 0.0525, 'component': 'entry_point'},
        'months_of_supply': {'weight': 0.0375, 'component': 'entry_point'},
        'volatility_36m': {'weight': 0.035, 'component': 'risk'},
        'unemployment_rate': {'weight': 0.03, 'component': 'risk'},
        'inventory_surplus_pct': {'weight': 0.02, 'component': 'risk'},
        'large_multi_permits_yoy': {'weight': 0.015, 'component': 'risk'},
    },
    'market_health': {
        'pending_ratio': {'weight': 0.1575, 'component': 'demand_strength'},
        'median_days_on_market': {'weight': 0.1225, 'component': 'demand_strength'},
        'hotness_score': {'weight': 0.07, 'component': 'demand_strength'},
        'months_of_supply': {'weight': 0.10, 'component': 'supply_balance'},
        'active_listing_count_yy': {'weight': 0.0875, 'component': 'supply_balance'},
        'new_listing_count_yy': {'weight': 0.0625, 'component': 'supply_balance'},
        'price_reduced_share': {'weight': 0.10, 'component': 'price_stability'},
        'sale_to_list_ratio': {'weight': 0.0875, 'component': 'price_stability'},
        'zhvi_yoy': {'weight': 0.0625, 'component': 'price_stability'},
        'unemployment_rate': {'weight': 0.075, 'component': 'economic_foundation'},
        'employment_yoy': {'weight': 0.075, 'component': 'economic_foundation'},
    }
}


def get_db_connection():
    """Create database connection from environment variables."""
    import psycopg2
    return psycopg2.connect(os.getenv('DATABASE_URL'))


def load_backtest_data(
    score_type: str,
    geography_type: str,
    period_start: str,
    period_end: str,
    horizon: str
) -> pd.DataFrame:
    """Load historical scores and outcomes from database."""

    conn = get_db_connection()

    feature_cols = SCORE_METRICS[score_type]
    outcome_col = OUTCOME_COLUMNS[horizon]

    # Build query to join scores with outcomes
    query = f"""
    SELECT
        s.geography_id,
        s.period_date,
        s.{score_type}_score as formula_score,
        {', '.join([f'd.{col}' for col in feature_cols])},
        o.{outcome_col} as outcome
    FROM propertyiq_scores s
    JOIN propertyiq_score_details d ON s.geography_id = d.geography_id
        AND s.period_date = d.period_date
    JOIN (
        -- Calculate outcomes by looking ahead
        SELECT
            geography_id,
            period_date,
            (LEAD(zhvi, {_horizon_to_months(horizon)}) OVER (
                PARTITION BY geography_id ORDER BY period_date
            ) - zhvi) / NULLIF(zhvi, 0) * 100 as {outcome_col}
        FROM zillow_{geography_type}
    ) o ON s.geography_id = o.geography_id AND s.period_date = o.period_date
    WHERE s.geography_type = %s
        AND s.period_date BETWEEN %s AND %s
        AND o.{outcome_col} IS NOT NULL
    """

    df = pd.read_sql(query, conn, params=[geography_type, period_start, period_end])
    conn.close()

    # Fill missing values with median (or could use inheritance)
    for col in feature_cols:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median())

    return df


def _horizon_to_months(horizon: str) -> int:
    """Convert horizon string to number of months."""
    mapping = {'6m': 6, '1y': 12, '3y': 36, '5y': 60}
    return mapping.get(horizon, 12)


def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> ValidationMetrics:
    """Calculate all comparison metrics."""

    # Remove NaN values
    mask = ~(np.isnan(y_true) | np.isnan(y_pred))
    y_true = y_true[mask]
    y_pred = y_pred[mask]

    if len(y_true) < 10:
        return ValidationMetrics(
            r2=0, directional_accuracy=0, mae=0, rmse=0,
            top_quintile_outcome=0, bottom_quintile_outcome=0, quintile_spread=0
        )

    # Sort by prediction for quintile analysis
    sorted_idx = np.argsort(y_pred)[::-1]
    n = len(y_true)
    quintile_size = max(1, n // 5)

    top_quintile_idx = sorted_idx[:quintile_size]
    bottom_quintile_idx = sorted_idx[-quintile_size:]

    # Directional accuracy: did we correctly predict above/below median?
    median_pred = np.median(y_pred)
    median_true = np.median(y_true)
    directional_acc = np.mean(
        (y_pred > median_pred) == (y_true > median_true)
    )

    return ValidationMetrics(
        r2=float(max(0, r2_score(y_true, y_pred))),
        directional_accuracy=float(directional_acc),
        mae=float(mean_absolute_error(y_true, y_pred)),
        rmse=float(np.sqrt(mean_squared_error(y_true, y_pred))),
        top_quintile_outcome=float(np.mean(y_true[top_quintile_idx])),
        bottom_quintile_outcome=float(np.mean(y_true[bottom_quintile_idx])),
        quintile_spread=float(
            np.mean(y_true[top_quintile_idx]) - np.mean(y_true[bottom_quintile_idx])
        )
    )


def process_feature_importance(
    feature_importance: pd.DataFrame,
    score_type: str
) -> List[Dict[str, Any]]:
    """Process feature importance and compare to current weights."""

    current_weights = FORMULA_WEIGHTS.get(score_type, {})

    results = []
    total_importance = feature_importance['importance'].sum()

    for _, row in feature_importance.iterrows():
        feature = row.name if isinstance(row.name, str) else row.get('index', str(row.name))
        importance = row['importance'] / total_importance if total_importance > 0 else 0

        current = current_weights.get(feature, {})
        current_weight = current.get('weight')
        component = current.get('component')

        # Determine status
        if current_weight is None:
            status = 'missing'
        elif importance > 0.05 and (current_weight or 0) < importance * 0.5:
            status = 'underweight'
        elif importance < 0.02 and (current_weight or 0) > 0.05:
            status = 'overweight'
        else:
            status = 'aligned'

        results.append({
            'feature': feature,
            'importance': round(importance, 4),
            'current_weight': current_weight,
            'component': component,
            'status': status
        })

    # Sort by importance descending
    results.sort(key=lambda x: x['importance'], reverse=True)

    return results


def generate_suggestions(
    feature_importance: List[Dict],
    score_type: str
) -> Tuple[List[Dict], List[Dict]]:
    """Generate weight adjustment suggestions based on ML importance."""

    current_weights = FORMULA_WEIGHTS.get(score_type, {})

    # Group by component
    component_importance = {}
    for fi in feature_importance:
        comp = fi.get('component')
        if comp:
            if comp not in component_importance:
                component_importance[comp] = 0
            component_importance[comp] += fi['importance']

    # Get current component weights
    component_weights = {
        'homeready': {
            'affordability': 0.30, 'market_timing': 0.25, 'stability': 0.20,
            'growth_potential': 0.15, 'livability': 0.10
        },
        'investoredge': {
            'cash_flow': 0.35, 'rent_demand': 0.20, 'appreciation': 0.20,
            'entry_point': 0.15, 'risk': 0.10
        },
        'market_health': {
            'demand_strength': 0.35, 'supply_balance': 0.25,
            'price_stability': 0.25, 'economic_foundation': 0.15
        }
    }.get(score_type, {})

    # Generate weight suggestions
    suggested_weights = []
    total_ml_weight = sum(component_importance.values()) or 1

    for comp, current in component_weights.items():
        ml_weight = component_importance.get(comp, 0) / total_ml_weight
        suggested = round(ml_weight, 2)
        change = suggested - current

        if abs(change) >= 0.02:  # Only suggest if change >= 2%
            rationale = (
                f"ML importance {ml_weight:.0%} vs current {current:.0%}"
                if change > 0 else
                f"Lower ML signal ({ml_weight:.0%})"
            )
            suggested_weights.append({
                'component': comp,
                'current_weight': current,
                'suggested_weight': suggested,
                'change': round(change, 2),
                'rationale': rationale
            })

    # Suggest metrics to add
    suggested_metrics = []
    for fi in feature_importance:
        if fi['status'] == 'missing' and fi['importance'] >= 0.05:
            suggested_metrics.append({
                'metric': fi['feature'],
                'ml_importance': fi['importance'],
                'suggested_component': _suggest_component(fi['feature'], score_type),
                'rationale': f"ML ranks this feature with {fi['importance']:.1%} importance"
            })

    return suggested_weights, suggested_metrics


def _suggest_component(metric: str, score_type: str) -> str:
    """Suggest which component a metric should belong to."""
    # Simple heuristic mapping
    if 'price' in metric or 'value' in metric or 'zhvi' in metric:
        return 'growth_potential' if score_type == 'homeready' else 'appreciation'
    if 'rent' in metric or 'zori' in metric:
        return 'affordability' if score_type == 'homeready' else 'rent_demand'
    if 'inventory' in metric or 'listing' in metric:
        return 'market_timing' if score_type == 'homeready' else 'supply_balance'
    return 'stability' if score_type == 'homeready' else 'risk'


def run_subgroup_analysis(
    df: pd.DataFrame,
    formula_predictions: np.ndarray,
    ml_predictions: np.ndarray,
    y_true: np.ndarray,
    geography_type: str
) -> List[Dict]:
    """Run subgroup analysis to find performance disparities."""

    results = []

    # By geography type (if we have mixed types)
    if 'geography_type' in df.columns:
        geo_analysis = {'dimension': 'geography_type', 'segments': []}
        for geo_type in df['geography_type'].unique():
            mask = df['geography_type'] == geo_type
            if mask.sum() >= 50:
                formula_metrics = calculate_metrics(y_true[mask], formula_predictions[mask])
                ml_metrics = calculate_metrics(y_true[mask], ml_predictions[mask])
                gap = ml_metrics.r2 - formula_metrics.r2
                geo_analysis['segments'].append({
                    'name': geo_type,
                    'formula_r2': formula_metrics.r2,
                    'ml_r2': ml_metrics.r2,
                    'gap': gap,
                    'sample_size': int(mask.sum()),
                    'status': _gap_to_status(gap, formula_metrics.r2)
                })
        if geo_analysis['segments']:
            results.append(geo_analysis)

    # By price tier
    if 'zhvi' in df.columns or 'median_listing_price' in df.columns:
        price_col = 'zhvi' if 'zhvi' in df.columns else 'median_listing_price'
        price_analysis = {'dimension': 'price_tier', 'segments': []}

        # Create price tiers
        df['_price_tier'] = pd.cut(
            df[price_col].fillna(df[price_col].median()),
            bins=[0, 200000, 500000, 1000000, float('inf')],
            labels=['under_200k', '200k_500k', '500k_1m', 'over_1m']
        )

        for tier in ['under_200k', '200k_500k', '500k_1m', 'over_1m']:
            mask = df['_price_tier'] == tier
            if mask.sum() >= 30:
                formula_metrics = calculate_metrics(y_true[mask], formula_predictions[mask])
                ml_metrics = calculate_metrics(y_true[mask], ml_predictions[mask])
                gap = ml_metrics.r2 - formula_metrics.r2
                price_analysis['segments'].append({
                    'name': tier,
                    'formula_r2': formula_metrics.r2,
                    'ml_r2': ml_metrics.r2,
                    'gap': gap,
                    'sample_size': int(mask.sum()),
                    'status': _gap_to_status(gap, formula_metrics.r2)
                })
        if price_analysis['segments']:
            results.append(price_analysis)

    return results


def _gap_to_status(gap: float, formula_r2: float) -> str:
    """Convert gap to status."""
    if formula_r2 <= 0:
        return 'action_required'
    relative_gap = gap / formula_r2 if formula_r2 > 0 else 0
    if relative_gap > 0.25:
        return 'action_required'
    elif relative_gap > 0.10:
        return 'review'
    return 'ok'


def save_validation_result(result: Dict, config: MLValidationConfig) -> str:
    """Save validation result to database."""

    conn = get_db_connection()
    cur = conn.cursor()

    # Insert result
    cur.execute("""
        INSERT INTO propertyiq_ml_validations (
            score_type, geography_type, horizon,
            train_period_start, train_period_end,
            test_period_start, test_period_end,
            ml_preset, time_limit_seconds,
            formula_r2, formula_directional_accuracy,
            formula_mae, formula_rmse, formula_quintile_spread,
            ml_r2, ml_directional_accuracy,
            ml_mae, ml_rmse, ml_quintile_spread,
            feature_importance, suggested_weights, suggested_metrics,
            subgroup_analysis, ml_leaderboard,
            training_time_seconds, test_samples, features_used,
            status
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s
        ) RETURNING id
    """, (
        config.score_type, config.geography_type, config.horizon,
        config.train_period_start, config.train_period_end,
        config.test_period_start, config.test_period_end,
        config.ml_preset, config.time_limit_seconds,
        result['formula_metrics']['r2'],
        result['formula_metrics']['directional_accuracy'],
        result['formula_metrics']['mae'],
        result['formula_metrics']['rmse'],
        result['formula_metrics']['quintile_spread'],
        result['ml_metrics']['r2'],
        result['ml_metrics']['directional_accuracy'],
        result['ml_metrics']['mae'],
        result['ml_metrics']['rmse'],
        result['ml_metrics']['quintile_spread'],
        json.dumps(result['feature_importance']),
        json.dumps(result['suggested_weights']),
        json.dumps(result['suggested_metrics']),
        json.dumps(result['subgroup_analysis']),
        json.dumps(result['ml_leaderboard']),
        result['training_time'],
        result['test_samples'],
        result['features_used'],
        result['status']
    ))

    result_id = cur.fetchone()[0]
    conn.commit()
    conn.close()

    return str(result_id)


def update_job_status(
    job_id: str,
    status: str,
    progress: float = None,
    result: Dict = None,
    error: str = None
):
    """Update job status in database."""

    conn = get_db_connection()
    cur = conn.cursor()

    updates = ["status = %s"]
    params = [status]

    if progress is not None:
        updates.append("progress = %s")
        params.append(progress)

    if status == 'running' and 'started_at' not in updates:
        updates.append("started_at = NOW()")

    if status in ('completed', 'failed'):
        updates.append("completed_at = NOW()")

    if result is not None:
        updates.append("result = %s")
        params.append(json.dumps(result))

    if error is not None:
        updates.append("error = %s")
        params.append(error)

    params.append(job_id)

    cur.execute(
        f"UPDATE propertyiq_ml_jobs SET {', '.join(updates)} WHERE id = %s",
        params
    )
    conn.commit()
    conn.close()


def run_ml_validation(config: MLValidationConfig) -> Dict:
    """
    Run ML validation comparing formula scores against AutoGluon predictions.

    Args:
        config: MLValidationConfig with all parameters

    Returns:
        Dictionary with validation results
    """

    if not AUTOGLUON_AVAILABLE:
        raise RuntimeError("AutoGluon not installed")

    print(f"Starting ML validation for {config.score_type} @ {config.geography_type} @ {config.horizon}")

    # Update job status if job_id provided
    if config.job_id:
        update_job_status(config.job_id, 'running', progress=0)

    try:
        # 1. Load training data
        print("Loading training data...")
        train_df = load_backtest_data(
            config.score_type,
            config.geography_type,
            config.train_period_start,
            config.train_period_end,
            config.horizon
        )
        print(f"  Loaded {len(train_df)} training samples")

        if config.job_id:
            update_job_status(config.job_id, 'running', progress=10)

        # 2. Load test data
        print("Loading test data...")
        test_df = load_backtest_data(
            config.score_type,
            config.geography_type,
            config.test_period_start,
            config.test_period_end,
            config.horizon
        )
        print(f"  Loaded {len(test_df)} test samples")

        if len(test_df) < 50:
            raise ValueError(f"Insufficient test data: {len(test_df)} samples (need >= 50)")

        if config.job_id:
            update_job_status(config.job_id, 'running', progress=20)

        # 3. Prepare features and target
        feature_cols = SCORE_METRICS[config.score_type]
        target_col = 'outcome'

        # Filter to available features
        available_features = [c for c in feature_cols if c in train_df.columns]
        print(f"  Using {len(available_features)}/{len(feature_cols)} features")

        # 4. Get formula predictions (already in test_df)
        formula_predictions = test_df['formula_score'].values

        if config.job_id:
            update_job_status(config.job_id, 'running', progress=30)

        # 5. Train AutoGluon model
        print(f"Training AutoGluon with preset={config.ml_preset}, time_limit={config.time_limit_seconds}s...")

        save_path = f"/tmp/autogluon/{config.score_type}_{config.horizon}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        predictor = TabularPredictor(
            label=target_col,
            eval_metric='r2',
            path=save_path,
            verbosity=1
        )

        start_time = time.time()
        predictor.fit(
            train_data=train_df[available_features + [target_col]],
            presets=config.ml_preset,
            time_limit=config.time_limit_seconds,
            num_bag_folds=5,
            num_stack_levels=1
        )
        training_time = time.time() - start_time
        print(f"  Training completed in {training_time:.1f}s")

        if config.job_id:
            update_job_status(config.job_id, 'running', progress=70)

        # 6. Get ML predictions
        print("Generating ML predictions...")
        ml_predictions = predictor.predict(test_df[available_features])

        # 7. Calculate metrics for both
        y_true = test_df[target_col].values

        formula_metrics = calculate_metrics(y_true, formula_predictions)
        ml_metrics = calculate_metrics(y_true, ml_predictions.values)

        print(f"  Formula R²: {formula_metrics.r2:.4f}")
        print(f"  ML R²: {ml_metrics.r2:.4f}")

        if config.job_id:
            update_job_status(config.job_id, 'running', progress=80)

        # 8. Get feature importance
        print("Extracting feature importance...")
        fi = predictor.feature_importance(
            test_df[available_features + [target_col]],
            silent=True
        )
        feature_importance = process_feature_importance(fi, config.score_type)

        # 9. Generate suggestions
        print("Generating suggestions...")
        suggested_weights, suggested_metrics = generate_suggestions(
            feature_importance,
            config.score_type
        )

        # 10. Run subgroup analysis
        print("Running subgroup analysis...")
        subgroup_analysis = run_subgroup_analysis(
            test_df,
            formula_predictions,
            ml_predictions.values,
            y_true,
            config.geography_type
        )

        if config.job_id:
            update_job_status(config.job_id, 'running', progress=90)

        # 11. Get leaderboard
        print("Getting model leaderboard...")
        lb = predictor.leaderboard(
            test_df[available_features + [target_col]],
            silent=True
        )
        ml_leaderboard = lb.head(10).to_dict(orient='records')

        # 12. Determine overall status
        r2_gap = ml_metrics.r2 - formula_metrics.r2
        relative_gap = r2_gap / max(formula_metrics.r2, 0.01)

        if relative_gap > 0.25:
            status = 'action_required'
        elif relative_gap > 0.10:
            status = 'review'
        else:
            status = 'ok'

        # 13. Compile results
        result = {
            'config': asdict(config),
            'run_at': datetime.now().isoformat(),
            'formula_metrics': asdict(formula_metrics),
            'ml_metrics': asdict(ml_metrics),
            'feature_importance': feature_importance,
            'suggested_weights': suggested_weights,
            'suggested_metrics': suggested_metrics,
            'subgroup_analysis': subgroup_analysis,
            'ml_leaderboard': ml_leaderboard,
            'training_time': training_time,
            'test_samples': len(test_df),
            'features_used': len(available_features),
            'status': status
        }

        # 14. Save to database
        print("Saving results to database...")
        result_id = save_validation_result(result, config)
        result['id'] = result_id

        # 15. Update job status
        if config.job_id:
            update_job_status(config.job_id, 'completed', progress=100, result={'validation_id': result_id})

        # 16. Cleanup
        print("Cleaning up temporary files...")
        shutil.rmtree(save_path, ignore_errors=True)

        print(f"\nML Validation complete!")
        print(f"  Status: {status}")
        print(f"  Formula R²: {formula_metrics.r2:.4f}")
        print(f"  ML R²: {ml_metrics.r2:.4f}")
        print(f"  Gap: {r2_gap:+.4f} ({relative_gap:+.1%} relative)")

        return result

    except Exception as e:
        if config.job_id:
            update_job_status(config.job_id, 'failed', error=str(e))
        raise


def main():
    """CLI entry point."""

    parser = argparse.ArgumentParser(description='Run ML validation for PropertyIQ scores')
    parser.add_argument('--config', type=str, help='Path to config JSON file')
    parser.add_argument('--job-id', type=str, help='Job ID to resume from database')
    parser.add_argument('--score-type', type=str, default='homeready',
                       choices=['homeready', 'investoredge', 'market_health'])
    parser.add_argument('--geography-type', type=str, default='metro',
                       choices=['metro', 'county', 'zip'])
    parser.add_argument('--horizon', type=str, default='1y',
                       choices=['6m', '1y', '3y', '5y'])
    parser.add_argument('--train-start', type=str, default='2019-01-01')
    parser.add_argument('--train-end', type=str, default='2023-12-31')
    parser.add_argument('--test-start', type=str, default='2024-01-01')
    parser.add_argument('--test-end', type=str, default='2024-12-31')
    parser.add_argument('--ml-preset', type=str, default='best_quality',
                       choices=['medium_quality', 'best_quality', 'high_quality'])
    parser.add_argument('--time-limit', type=int, default=300)

    args = parser.parse_args()

    if args.config:
        with open(args.config) as f:
            config_dict = json.load(f)
        config = MLValidationConfig(**config_dict)
    elif args.job_id:
        # Load config from database job
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT config FROM propertyiq_ml_jobs WHERE id = %s", (args.job_id,))
        row = cur.fetchone()
        conn.close()
        if not row:
            print(f"Job {args.job_id} not found")
            sys.exit(1)
        config_dict = row[0]
        config_dict['job_id'] = args.job_id
        config = MLValidationConfig(**config_dict)
    else:
        config = MLValidationConfig(
            score_type=args.score_type,
            geography_type=args.geography_type,
            horizon=args.horizon,
            train_period_start=args.train_start,
            train_period_end=args.train_end,
            test_period_start=args.test_start,
            test_period_end=args.test_end,
            ml_preset=args.ml_preset,
            time_limit_seconds=args.time_limit
        )

    result = run_ml_validation(config)

    # Output result as JSON
    print("\n" + "=" * 60)
    print("RESULT:")
    print(json.dumps({
        'id': result.get('id'),
        'status': result['status'],
        'formula_r2': result['formula_metrics']['r2'],
        'ml_r2': result['ml_metrics']['r2'],
        'suggestions_count': len(result['suggested_weights']) + len(result['suggested_metrics'])
    }, indent=2))


if __name__ == '__main__':
    main()
