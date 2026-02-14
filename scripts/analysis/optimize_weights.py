#!/usr/bin/env python3
"""
PropertyIQ Weight Optimization Script
======================================
Finds optimal formula weights for HomeReady and InvestorEdge scoring formulas
using walk-forward cross-validation targeting excess returns vs division median.

Usage:
    python optimize_weights.py --score-type both --output-dir output
    python optimize_weights.py --score-type homeready
    python optimize_weights.py --score-type investoredge --output-dir /path/to/results
"""

import argparse
import json
import os
import sys
import warnings
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras
from scipy import stats
from sklearn.linear_model import ElasticNet, ElasticNetCV
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SUPABASE_PROJECT_REF = "pysflbhpnqwoczyuaaif"

HOMEREADY_CANDIDATE_METRICS = [
    "hotness_score",
    "demand_score",
    "pending_ratio",
    "price_reduced_share",
    "supply_score",
    "median_days_on_market",
    "population_yoy",
    "unemployment_rate_yoy",
    "affordability_ratio",
    "zhvi_yoy",
    "inventory_yoy",
]

INVESTOREDGE_CANDIDATE_METRICS = HOMEREADY_CANDIDATE_METRICS + [
    "rent_price_ratio",
    "median_gross_rent",
    "homeownership_rate",
    "zori_yoy",
]

CURRENT_WEIGHTS = {
    "homeready": {
        "metrics": [
            {"name": "hotness_score", "weight": 0.706, "direction": 1},
            {"name": "pending_ratio", "weight": 0.152, "direction": 1},
            {"name": "unemployment_rate_yoy", "weight": 0.057, "direction": -1},
            {"name": "population_yoy", "weight": 0.054, "direction": -1},
            {"name": "demand_score", "weight": 0.031, "direction": 1},
        ],
        "version": "v1.0",
    },
    "investoredge": {
        "metrics": [
            {"name": "hotness_score", "weight": 0.317, "direction": 1},
            {"name": "median_gross_rent", "weight": 0.315, "direction": -1},
            {"name": "affordability_ratio", "weight": 0.188, "direction": -1},
            {"name": "pending_ratio", "weight": 0.080, "direction": 1},
            {"name": "homeownership_rate", "weight": 0.047, "direction": 1},
            {"name": "population_yoy", "weight": 0.035, "direction": -1},
            {"name": "unemployment_rate_yoy", "weight": 0.018, "direction": -1},
        ],
        "version": "v1.0",
    },
}

MAX_FEATURES = 8
STABILITY_CV_THRESHOLD = 1.0
MIN_COEF_THRESHOLD = 0.02
MIN_COEF_WINDOW_FRAC = 0.50
BOOTSTRAP_ITERATIONS = 1000
BOOTSTRAP_CI = 0.95

# Walk-forward windows: (train_start, train_end, test_start, test_end)
WALK_FORWARD_WINDOWS = [
    # Primary 24-month train / 12-month test
    (date(2020, 12, 1), date(2022, 11, 1), date(2022, 12, 1), date(2023, 11, 1)),
    (date(2021, 12, 1), date(2023, 11, 1), date(2023, 12, 1), date(2024, 11, 1)),
    # 6-month shifted windows for additional test periods
    (date(2021, 6, 1), date(2023, 5, 1), date(2023, 6, 1), date(2024, 5, 1)),
    (date(2021, 3, 1), date(2023, 2, 1), date(2023, 3, 1), date(2024, 2, 1)),
]


# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------


def get_db_connection():
    """
    Establish a PostgreSQL connection to the Supabase database.

    Tries in order:
      1. DATABASE_URL environment variable (direct connection string)
      2. Supabase pooler connection (preferred for serverless / long-running scripts)
    """
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        print("[DB] Connecting via DATABASE_URL ...")
        return psycopg2.connect(database_url)

    # Use Supabase connection pooler (PgBouncer)
    host = "aws-1-us-east-1.pooler.supabase.com"
    port = 6543
    user = f"postgres.{SUPABASE_PROJECT_REF}"
    password = os.environ.get("SUPABASE_DB_PASSWORD", "IHatedoingpt12")
    conn_str = (
        f"host={host} port={port} dbname=postgres "
        f"user={user} password={password} sslmode=require"
    )
    print(f"[DB] Connecting to {host}:{port} via Supabase pooler ...")
    return psycopg2.connect(conn_str)


# ---------------------------------------------------------------------------
# Step 3.1  Feature Matrix Construction
# ---------------------------------------------------------------------------


def load_feature_matrix(
    conn, score_type: str, candidate_metrics: List[str], geo_level: str = "metro"
) -> pd.DataFrame:
    """
    Build (geography, score_date) feature matrix by joining z-scores from
    propertyiq_scores with backtest outcomes.

    Args:
        geo_level: 'metro', 'county', or 'zip'

    Returns a DataFrame with columns:
        geography_id, score_date, <z_score columns>, target
    """
    print(f"\n[3.1] Building feature matrix for {score_type} / {geo_level} ...")

    # Determine target column based on score type
    if score_type == "homeready":
        target_expr = "bo.excess_vs_state_3y"
        target_alias = "target"
    else:
        # investoredge: 3Y total return excess = appreciation excess + rent yield excess
        target_expr = """CASE WHEN bo.rent_return_3y_cagr IS NOT NULL
            THEN (bo.excess_vs_state_3y + bo.rent_return_3y_cagr)
            ELSE bo.excess_vs_state_3y END"""
        target_alias = "target"

    geo_filter = f"AND bo.geography_type = '{geo_level}'"

    query = f"""
        SELECT
            bo.geography_id,
            bo.score_date,
            ps.z_scores,
            {target_expr} AS {target_alias}
        FROM propertyiq_backtest_outcomes bo
        LEFT JOIN propertyiq_scores ps
            ON ps.location_id = bo.geography_id
            AND ps.geography = bo.geography_type
            AND ps.score_type = bo.score_type
            AND ps.score_date = bo.score_date
        WHERE bo.score_type = %s
            {geo_filter}
            AND {target_expr} IS NOT NULL
        ORDER BY bo.score_date, bo.geography_id
    """

    df = pd.read_sql(query, conn, params=(score_type,))
    print(f"    Raw rows returned: {len(df)}")

    if df.empty:
        print(f"    [WARN] No data returned for {score_type}. Check table contents.")
        return pd.DataFrame()

    # Parse z_scores JSONB into individual columns
    def extract_z_scores(row):
        z = row["z_scores"]
        if isinstance(z, str):
            z = json.loads(z)
        if z is None:
            return {}
        return {m: z.get(m, np.nan) for m in candidate_metrics}

    z_expanded = df.apply(extract_z_scores, axis=1, result_type="expand")
    df = pd.concat([df[["geography_id", "score_date", "target"]], z_expanded], axis=1)

    # Drop rows where all z-score columns are NaN
    z_cols = [c for c in candidate_metrics if c in df.columns]
    df.dropna(subset=z_cols, how="all", inplace=True)

    # Fill remaining NaN z-scores with 0 (neutral)
    df[z_cols] = df[z_cols].fillna(0.0)

    # Ensure score_date is a proper date
    df["score_date"] = pd.to_datetime(df["score_date"]).dt.date

    n_metros = df["geography_id"].nunique()
    n_dates = df["score_date"].nunique()
    print(f"    Feature matrix: {len(df)} rows, {n_metros} metros, {n_dates} dates")
    print(f"    Date range: {df['score_date'].min()} to {df['score_date'].max()}")
    print(f"    Available features: {z_cols}")

    return df


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------


def compute_ic(predicted: np.ndarray, actual: np.ndarray) -> float:
    """Spearman rank Information Coefficient."""
    if len(predicted) < 5:
        return np.nan
    corr, _ = stats.spearmanr(predicted, actual)
    return corr


def compute_quintile_spread(predicted: np.ndarray, actual: np.ndarray) -> float:
    """
    Mean excess return of top quintile minus bottom quintile.
    """
    if len(predicted) < 10:
        return np.nan
    n = len(predicted)
    q_size = n // 5
    if q_size < 2:
        return np.nan

    idx_sorted = np.argsort(predicted)
    bottom_idx = idx_sorted[:q_size]
    top_idx = idx_sorted[-q_size:]

    return float(np.mean(actual[top_idx]) - np.mean(actual[bottom_idx]))


def compute_hit_rate(predicted: np.ndarray, actual: np.ndarray) -> float:
    """
    Fraction of top-quintile picks that beat the median outcome.
    """
    if len(predicted) < 10:
        return np.nan
    n = len(predicted)
    q_size = n // 5
    if q_size < 2:
        return np.nan

    median_actual = np.median(actual)
    idx_sorted = np.argsort(predicted)
    top_idx = idx_sorted[-q_size:]

    hits = np.sum(actual[top_idx] > median_actual)
    return float(hits / q_size)


def compute_score_with_weights(
    features: pd.DataFrame, weights: Dict[str, float], directions: Dict[str, int]
) -> np.ndarray:
    """
    Apply formula weights to z-score features, respecting direction signs.
    """
    score = np.zeros(len(features))
    for metric, w in weights.items():
        if metric in features.columns:
            direction = directions.get(metric, 1)
            score += w * direction * features[metric].values
    return score


def current_weights_to_dicts(score_type: str) -> Tuple[Dict[str, float], Dict[str, int]]:
    """Extract weight and direction dicts from CURRENT_WEIGHTS."""
    info = CURRENT_WEIGHTS[score_type]
    weights = {m["name"]: m["weight"] for m in info["metrics"]}
    directions = {m["name"]: m["direction"] for m in info["metrics"]}
    return weights, directions


# ---------------------------------------------------------------------------
# Step 3.2  Walk-Forward Cross-Validation
# ---------------------------------------------------------------------------


def run_walk_forward_cv(
    df: pd.DataFrame,
    candidate_metrics: List[str],
    score_type: str,
) -> List[Dict[str, Any]]:
    """
    Walk-forward cross-validation with elastic net regression.
    Returns per-window results.
    """
    print(f"\n[3.2] Walk-forward cross-validation for {score_type} ...")

    available_metrics = [m for m in candidate_metrics if m in df.columns]
    window_results = []

    for i, (train_start, train_end, test_start, test_end) in enumerate(
        WALK_FORWARD_WINDOWS
    ):
        print(
            f"\n    Window {i + 1}: "
            f"Train {train_start} - {train_end} | Test {test_start} - {test_end}"
        )

        train_mask = (df["score_date"] >= train_start) & (df["score_date"] <= train_end)
        test_mask = (df["score_date"] >= test_start) & (df["score_date"] <= test_end)

        train_df = df[train_mask].copy()
        test_df = df[test_mask].copy()

        print(f"      Train rows: {len(train_df)}, Test rows: {len(test_df)}")

        if len(train_df) < 50 or len(test_df) < 20:
            print("      [SKIP] Insufficient data for this window.")
            continue

        X_train = train_df[available_metrics].values
        y_train = train_df["target"].values
        X_test = test_df[available_metrics].values
        y_test = test_df["target"].values

        # Standardize within training window
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        # Elastic net with cross-validation to pick best alpha
        try:
            enet_cv = ElasticNetCV(
                l1_ratio=[0.1, 0.3, 0.5, 0.7, 0.9],
                n_alphas=50,
                cv=5,
                max_iter=10000,
                random_state=42,
                n_jobs=-1,
            )
            enet_cv.fit(X_train_scaled, y_train)
            best_alpha = enet_cv.alpha_
            best_l1 = enet_cv.l1_ratio_
        except Exception as e:
            print(f"      [WARN] ElasticNetCV failed: {e}. Using defaults.")
            best_alpha = 0.01
            best_l1 = 0.5

        # Fit final elastic net with best parameters
        enet = ElasticNet(
            alpha=best_alpha,
            l1_ratio=best_l1,
            max_iter=10000,
            random_state=42,
        )
        enet.fit(X_train_scaled, y_train)

        # Extract coefficients
        raw_coefs = dict(zip(available_metrics, enet.coef_))

        # Predict on train and test
        pred_train = enet.predict(X_train_scaled)
        pred_test = enet.predict(X_test_scaled)

        # In-sample metrics
        train_ic = compute_ic(pred_train, y_train)
        train_qs = compute_quintile_spread(pred_train, y_train)
        train_hr = compute_hit_rate(pred_train, y_train)

        # Out-of-sample metrics
        test_ic = compute_ic(pred_test, y_test)
        test_qs = compute_quintile_spread(pred_test, y_test)
        test_hr = compute_hit_rate(pred_test, y_test)

        print(f"      Alpha={best_alpha:.5f}, L1_ratio={best_l1:.2f}")
        print(
            f"      Train IC={train_ic:.4f}, QS={train_qs:.4f}, HR={train_hr:.4f}"
        )
        print(
            f"      Test  IC={test_ic:.4f}, QS={test_qs:.4f}, HR={test_hr:.4f}"
        )

        # Non-zero features
        nonzero = {k: v for k, v in raw_coefs.items() if abs(v) > 1e-8}
        print(f"      Non-zero features: {len(nonzero)}/{len(available_metrics)}")
        for feat, coef in sorted(nonzero.items(), key=lambda x: abs(x[1]), reverse=True):
            print(f"        {feat:30s}  coef={coef:+.4f}")

        window_results.append(
            {
                "window": i + 1,
                "train_period": f"{train_start} to {train_end}",
                "test_period": f"{test_start} to {test_end}",
                "train_rows": len(train_df),
                "test_rows": len(test_df),
                "best_alpha": float(best_alpha),
                "best_l1_ratio": float(best_l1),
                "raw_coefs": {k: float(v) for k, v in raw_coefs.items()},
                "train_ic": float(train_ic) if not np.isnan(train_ic) else None,
                "train_quintile_spread": (
                    float(train_qs) if not np.isnan(train_qs) else None
                ),
                "train_hit_rate": (
                    float(train_hr) if not np.isnan(train_hr) else None
                ),
                "test_ic": float(test_ic) if not np.isnan(test_ic) else None,
                "test_quintile_spread": (
                    float(test_qs) if not np.isnan(test_qs) else None
                ),
                "test_hit_rate": (
                    float(test_hr) if not np.isnan(test_hr) else None
                ),
                "y_test": y_test.tolist(),
                "pred_test": pred_test.tolist(),
            }
        )

    return window_results


# ---------------------------------------------------------------------------
# Step 3.3  Feature Selection
# ---------------------------------------------------------------------------


def select_features(
    window_results: List[Dict[str, Any]],
    candidate_metrics: List[str],
) -> List[str]:
    """
    Select features based on elastic net coefficient consistency.

    Rules:
    - Drop features with |coef| < MIN_COEF_THRESHOLD in > 50% of windows
    - Keep at most MAX_FEATURES
    """
    print("\n[3.3] Feature selection ...")

    if not window_results:
        print("    [WARN] No window results to select from.")
        return []

    n_windows = len(window_results)

    # Count how many windows each feature exceeds the threshold
    feature_pass_count = defaultdict(int)
    feature_mean_abs_coef = defaultdict(float)

    for wr in window_results:
        coefs = wr["raw_coefs"]
        for metric in candidate_metrics:
            if metric in coefs and abs(coefs[metric]) >= MIN_COEF_THRESHOLD:
                feature_pass_count[metric] += 1
                feature_mean_abs_coef[metric] += abs(coefs[metric])

    # Normalize mean abs coef
    for m in feature_mean_abs_coef:
        feature_mean_abs_coef[m] /= n_windows

    # Filter: must pass threshold in >= 50% of windows
    min_passes = max(1, int(n_windows * MIN_COEF_WINDOW_FRAC))
    selected = [
        m
        for m in candidate_metrics
        if feature_pass_count.get(m, 0) >= min_passes
    ]

    print(f"    Features passing consistency filter ({min_passes}/{n_windows} windows):")
    for m in selected:
        print(
            f"      {m:30s}  passes={feature_pass_count[m]}/{n_windows}  "
            f"mean|coef|={feature_mean_abs_coef[m]:.4f}"
        )

    # If more than MAX_FEATURES, keep top by mean abs coefficient
    if len(selected) > MAX_FEATURES:
        selected.sort(key=lambda m: feature_mean_abs_coef[m], reverse=True)
        selected = selected[:MAX_FEATURES]
        print(f"    Trimmed to top {MAX_FEATURES} features.")

    # Show dropped features
    dropped = [m for m in candidate_metrics if m not in selected]
    if dropped:
        print(f"    Dropped features: {dropped}")

    return selected


def refit_with_selected_features(
    df: pd.DataFrame,
    selected_features: List[str],
    score_type: str,
) -> Tuple[List[Dict[str, Any]], Dict[str, float]]:
    """
    Re-run walk-forward CV using only the selected features.
    Returns per-window results and averaged raw coefficients.
    """
    print(f"\n[3.3b] Re-fitting with {len(selected_features)} selected features ...")

    window_results = []
    all_coefs = defaultdict(list)

    for i, (train_start, train_end, test_start, test_end) in enumerate(
        WALK_FORWARD_WINDOWS
    ):
        train_mask = (df["score_date"] >= train_start) & (df["score_date"] <= train_end)
        test_mask = (df["score_date"] >= test_start) & (df["score_date"] <= test_end)

        train_df = df[train_mask].copy()
        test_df = df[test_mask].copy()

        if len(train_df) < 50 or len(test_df) < 20:
            continue

        X_train = train_df[selected_features].values
        y_train = train_df["target"].values
        X_test = test_df[selected_features].values
        y_test = test_df["target"].values

        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        try:
            enet_cv = ElasticNetCV(
                l1_ratio=[0.1, 0.3, 0.5, 0.7, 0.9],
                n_alphas=50,
                cv=5,
                max_iter=10000,
                random_state=42,
                n_jobs=-1,
            )
            enet_cv.fit(X_train_scaled, y_train)
            best_alpha = enet_cv.alpha_
            best_l1 = enet_cv.l1_ratio_
        except Exception:
            best_alpha = 0.01
            best_l1 = 0.5

        enet = ElasticNet(
            alpha=best_alpha,
            l1_ratio=best_l1,
            max_iter=10000,
            random_state=42,
        )
        enet.fit(X_train_scaled, y_train)

        raw_coefs = dict(zip(selected_features, enet.coef_))
        for feat, coef in raw_coefs.items():
            all_coefs[feat].append(coef)

        pred_train = enet.predict(X_train_scaled)
        pred_test = enet.predict(X_test_scaled)

        train_ic = compute_ic(pred_train, y_train)
        test_ic = compute_ic(pred_test, y_test)
        test_qs = compute_quintile_spread(pred_test, y_test)
        test_hr = compute_hit_rate(pred_test, y_test)

        print(
            f"    Window {i+1}: Test IC={test_ic:.4f}, "
            f"QS={test_qs:.4f}, HR={test_hr:.4f}"
        )

        window_results.append(
            {
                "window": i + 1,
                "train_period": f"{train_start} to {train_end}",
                "test_period": f"{test_start} to {test_end}",
                "train_rows": len(train_df),
                "test_rows": len(test_df),
                "best_alpha": float(best_alpha),
                "best_l1_ratio": float(best_l1),
                "raw_coefs": {k: float(v) for k, v in raw_coefs.items()},
                "train_ic": _safe_float(train_ic),
                "train_quintile_spread": _safe_float(
                    compute_quintile_spread(pred_train, y_train)
                ),
                "train_hit_rate": _safe_float(compute_hit_rate(pred_train, y_train)),
                "test_ic": _safe_float(test_ic),
                "test_quintile_spread": _safe_float(test_qs),
                "test_hit_rate": _safe_float(test_hr),
                "y_test": y_test.tolist(),
                "pred_test": pred_test.tolist(),
            }
        )

    # Average raw coefficients across windows
    avg_coefs = {feat: float(np.mean(vals)) for feat, vals in all_coefs.items()}
    return window_results, avg_coefs


def _safe_float(val) -> Optional[float]:
    """Convert to float, returning None for NaN."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    return float(val)


# ---------------------------------------------------------------------------
# Step 3.4  Stability Check
# ---------------------------------------------------------------------------


def stability_check(
    window_results: List[Dict[str, Any]],
    selected_features: List[str],
) -> Tuple[List[str], Dict[str, Dict[str, Any]]]:
    """
    Check coefficient stability across walk-forward windows.
    Drops features with CV > STABILITY_CV_THRESHOLD.
    Flags sign flips.

    Returns (stable_features, stability_info).
    """
    print("\n[3.4] Stability check ...")

    coef_series = defaultdict(list)
    for wr in window_results:
        for feat in selected_features:
            coef_series[feat].append(wr["raw_coefs"].get(feat, 0.0))

    stability_info = {}
    stable_features = []

    for feat in selected_features:
        vals = np.array(coef_series[feat])
        mean_val = np.mean(vals)
        std_val = np.std(vals)
        cv = abs(std_val / mean_val) if abs(mean_val) > 1e-10 else float("inf")

        # Check sign flips
        signs = np.sign(vals)
        sign_flips = np.sum(np.diff(signs) != 0)
        has_sign_flip = bool(np.any(signs > 0) and np.any(signs < 0))

        info = {
            "mean_coef": float(mean_val),
            "std_coef": float(std_val),
            "cv": float(cv),
            "sign_flips": int(sign_flips),
            "has_mixed_signs": has_sign_flip,
            "values": vals.tolist(),
            "stable": cv < STABILITY_CV_THRESHOLD and not has_sign_flip,
        }
        stability_info[feat] = info

        status = "STABLE" if info["stable"] else "UNSTABLE"
        flag = " ** SIGN FLIP **" if has_sign_flip else ""
        print(
            f"    {feat:30s}  mean={mean_val:+.4f}  std={std_val:.4f}  "
            f"CV={cv:.3f}  {status}{flag}"
        )

        if info["stable"]:
            stable_features.append(feat)

    dropped = set(selected_features) - set(stable_features)
    if dropped:
        print(f"    Dropped unstable features: {dropped}")

    return stable_features, stability_info


# ---------------------------------------------------------------------------
# Step 3.5  Bootstrap Significance
# ---------------------------------------------------------------------------


def bootstrap_quintile_spread(
    window_results: List[Dict[str, Any]],
    n_iterations: int = BOOTSTRAP_ITERATIONS,
    ci_level: float = BOOTSTRAP_CI,
) -> Dict[str, Any]:
    """
    Bootstrap the quintile spread across all test windows to assess significance.
    Returns CI bounds and whether CI excludes zero.
    """
    print(f"\n[3.5] Bootstrap significance test ({n_iterations} iterations) ...")

    # Pool all test predictions and actuals across windows
    all_pred = []
    all_actual = []
    for wr in window_results:
        if wr.get("pred_test") and wr.get("y_test"):
            all_pred.extend(wr["pred_test"])
            all_actual.extend(wr["y_test"])

    all_pred = np.array(all_pred)
    all_actual = np.array(all_actual)

    if len(all_pred) < 20:
        print("    [WARN] Insufficient pooled test data for bootstrap.")
        return {
            "mean_qs": None,
            "ci_lower": None,
            "ci_upper": None,
            "significant": False,
            "n_samples": len(all_pred),
        }

    rng = np.random.RandomState(42)
    bootstrap_qs = []

    for _ in range(n_iterations):
        idx = rng.choice(len(all_pred), size=len(all_pred), replace=True)
        qs = compute_quintile_spread(all_pred[idx], all_actual[idx])
        if not np.isnan(qs):
            bootstrap_qs.append(qs)

    bootstrap_qs = np.array(bootstrap_qs)
    alpha = 1 - ci_level
    ci_lower = float(np.percentile(bootstrap_qs, 100 * alpha / 2))
    ci_upper = float(np.percentile(bootstrap_qs, 100 * (1 - alpha / 2)))
    mean_qs = float(np.mean(bootstrap_qs))
    significant = ci_lower > 0 or ci_upper < 0  # CI excludes zero

    print(f"    Pooled test samples: {len(all_pred)}")
    print(f"    Bootstrap iterations (valid): {len(bootstrap_qs)}")
    print(f"    Mean quintile spread: {mean_qs:.4f}")
    print(f"    {int(ci_level*100)}% CI: [{ci_lower:.4f}, {ci_upper:.4f}]")
    print(f"    Significant (CI excludes 0): {significant}")

    return {
        "mean_quintile_spread": mean_qs,
        "ci_lower": ci_lower,
        "ci_upper": ci_upper,
        "ci_level": ci_level,
        "significant": significant,
        "n_samples": len(all_pred),
        "n_valid_bootstraps": len(bootstrap_qs),
    }


# ---------------------------------------------------------------------------
# Step 3.6  Compare Old vs New
# ---------------------------------------------------------------------------


def evaluate_current_formula(
    df: pd.DataFrame,
    score_type: str,
) -> Dict[str, Optional[float]]:
    """
    Evaluate the current v1.0 weights on the same walk-forward test windows.
    """
    print(f"\n[3.6] Evaluating current v1.0 formula for {score_type} ...")

    weights, directions = current_weights_to_dicts(score_type)
    all_ics = []
    all_qs = []
    all_hr = []

    for i, (_, _, test_start, test_end) in enumerate(WALK_FORWARD_WINDOWS):
        test_mask = (df["score_date"] >= test_start) & (df["score_date"] <= test_end)
        test_df = df[test_mask].copy()

        if len(test_df) < 20:
            continue

        pred = compute_score_with_weights(test_df, weights, directions)
        actual = test_df["target"].values

        ic = compute_ic(pred, actual)
        qs = compute_quintile_spread(pred, actual)
        hr = compute_hit_rate(pred, actual)

        print(f"    Window {i+1}: IC={ic:.4f}, QS={qs:.4f}, HR={hr:.4f}")
        all_ics.append(ic)
        all_qs.append(qs)
        all_hr.append(hr)

    return {
        "mean_ic": _safe_float(np.mean(all_ics)) if all_ics else None,
        "mean_quintile_spread": _safe_float(np.mean(all_qs)) if all_qs else None,
        "mean_hit_rate": _safe_float(np.mean(all_hr)) if all_hr else None,
        "n_windows": len(all_ics),
    }


def build_comparison(
    old_metrics: Dict[str, Optional[float]],
    new_window_results: List[Dict[str, Any]],
    bootstrap_results: Dict[str, Any],
) -> Dict[str, Any]:
    """Build side-by-side comparison of old vs new formula."""
    # Aggregate new metrics
    new_ics = [wr["test_ic"] for wr in new_window_results if wr.get("test_ic") is not None]
    new_qs = [
        wr["test_quintile_spread"]
        for wr in new_window_results
        if wr.get("test_quintile_spread") is not None
    ]
    new_hr = [
        wr["test_hit_rate"]
        for wr in new_window_results
        if wr.get("test_hit_rate") is not None
    ]

    comparison = {
        "current_v1": {
            "mean_ic": old_metrics.get("mean_ic"),
            "mean_quintile_spread": old_metrics.get("mean_quintile_spread"),
            "mean_hit_rate": old_metrics.get("mean_hit_rate"),
        },
        "proposed_v2": {
            "mean_ic": _safe_float(np.mean(new_ics)) if new_ics else None,
            "mean_quintile_spread": _safe_float(np.mean(new_qs)) if new_qs else None,
            "mean_hit_rate": _safe_float(np.mean(new_hr)) if new_hr else None,
            "bootstrap_qs_ci_lower": bootstrap_results.get("ci_lower"),
            "bootstrap_qs_ci_upper": bootstrap_results.get("ci_upper"),
            "bootstrap_significant": bootstrap_results.get("significant"),
        },
    }
    return comparison


def print_comparison_table(comparison: Dict[str, Any], score_type: str):
    """Print a nicely formatted comparison table."""
    old = comparison["current_v1"]
    new = comparison["proposed_v2"]

    def fmt(val, pct=False):
        if val is None:
            return "N/A"
        if pct:
            return f"{val:.2%}"
        return f"{val:.4f}"

    print(f"\n{'='*70}")
    print(f"  PropertyIQ {score_type.upper()} -- Old vs New Comparison")
    print(f"{'='*70}")
    print(f"  {'Metric':<30s} {'Current v1.0':>15s} {'Proposed v2.0':>15s}")
    print(f"  {'-'*30} {'-'*15} {'-'*15}")
    print(f"  {'Mean IC (Spearman)':<30s} {fmt(old.get('mean_ic')):>15s} {fmt(new.get('mean_ic')):>15s}")
    print(f"  {'OOS Quintile Spread':<30s} {fmt(old.get('mean_quintile_spread')):>15s} {fmt(new.get('mean_quintile_spread')):>15s}")
    print(f"  {'OOS Hit Rate':<30s} {fmt(old.get('mean_hit_rate'), pct=True):>15s} {fmt(new.get('mean_hit_rate'), pct=True):>15s}")

    ci_lo = new.get("bootstrap_qs_ci_lower")
    ci_hi = new.get("bootstrap_qs_ci_upper")
    sig = new.get("bootstrap_significant")
    if ci_lo is not None and ci_hi is not None:
        print(f"  {'Bootstrap 95% CI (QS)':<30s} {'':>15s} [{ci_lo:.4f}, {ci_hi:.4f}]")
        print(f"  {'Significant (CI excl. 0)':<30s} {'':>15s} {'YES' if sig else 'NO':>15s}")
    print(f"{'='*70}\n")


# ---------------------------------------------------------------------------
# Weight normalization and direction inference
# ---------------------------------------------------------------------------


def normalize_weights(
    avg_coefs: Dict[str, float],
    stable_features: List[str],
) -> List[Dict[str, Any]]:
    """
    Convert raw elastic net coefficients to normalized formula weights.
    Weight = |coef_i| / sum(|coef_j|), direction = sign(coef_i).
    """
    # Filter to stable features only
    coefs = {f: avg_coefs.get(f, 0.0) for f in stable_features if abs(avg_coefs.get(f, 0.0)) > 1e-10}

    if not coefs:
        return []

    total_abs = sum(abs(v) for v in coefs.values())
    if total_abs < 1e-10:
        return []

    metrics = []
    for feat in sorted(coefs.keys(), key=lambda f: abs(coefs[f]), reverse=True):
        c = coefs[feat]
        metrics.append(
            {
                "name": feat,
                "weight": round(abs(c) / total_abs, 4),
                "direction": 1 if c > 0 else -1,
            }
        )

    # Re-normalize after rounding
    total_w = sum(m["weight"] for m in metrics)
    if total_w > 0:
        for m in metrics:
            m["weight"] = round(m["weight"] / total_w, 4)
        # Fix rounding to ensure exact sum = 1.0
        residual = round(1.0 - sum(m["weight"] for m in metrics), 4)
        if metrics:
            metrics[0]["weight"] = round(metrics[0]["weight"] + residual, 4)

    return metrics


# ---------------------------------------------------------------------------
# Main pipeline for one score type
# ---------------------------------------------------------------------------


def optimize_score_type(
    conn,
    score_type: str,
    geo_level: str = "metro",
) -> Dict[str, Any]:
    """Run the full optimization pipeline for a single score type."""
    print(f"\n{'#'*70}")
    print(f"#  Optimizing {score_type.upper()} / {geo_level.upper()}")
    print(f"{'#'*70}")

    # Determine candidate metrics
    if score_type == "homeready":
        candidate_metrics = HOMEREADY_CANDIDATE_METRICS
    else:
        candidate_metrics = INVESTOREDGE_CANDIDATE_METRICS

    # Step 3.1: Feature matrix
    df = load_feature_matrix(conn, score_type, candidate_metrics, geo_level=geo_level)
    if df.empty:
        return {"error": f"No data available for {score_type}"}

    # Step 3.2: Walk-forward CV (full feature set)
    initial_results = run_walk_forward_cv(df, candidate_metrics, score_type)

    if not initial_results:
        return {"error": f"No valid walk-forward windows for {score_type}"}

    # Step 3.3: Feature selection
    selected = select_features(initial_results, candidate_metrics)

    if not selected:
        print("    [WARN] No features selected. Using all candidates.")
        selected = [m for m in candidate_metrics if m in df.columns]

    # Re-fit with selected features
    refit_results, avg_coefs = refit_with_selected_features(df, selected, score_type)

    # Step 3.4: Stability check
    stable_features, stability_info = stability_check(refit_results, selected)

    if not stable_features:
        print("    [WARN] No stable features after stability check. Relaxing constraints.")
        # Fall back to selected features, just flag instability
        stable_features = selected

    # Final re-fit with stable features only (if different from selected)
    if set(stable_features) != set(selected):
        print(f"\n    Final re-fit with {len(stable_features)} stable features ...")
        final_results, avg_coefs = refit_with_selected_features(
            df, stable_features, score_type
        )
    else:
        final_results = refit_results

    # Step 3.5: Bootstrap significance
    bootstrap_results = bootstrap_quintile_spread(final_results)

    # Step 3.6: Compare old vs new
    old_metrics = evaluate_current_formula(df, score_type)
    comparison = build_comparison(old_metrics, final_results, bootstrap_results)

    print_comparison_table(comparison, score_type)

    # Build normalized weights
    new_metrics = normalize_weights(avg_coefs, stable_features)

    print(f"\n  Proposed v2.0 weights for {score_type}:")
    for m in new_metrics:
        dir_str = "+" if m["direction"] == 1 else "-"
        print(f"    {m['name']:30s}  weight={m['weight']:.4f}  direction={dir_str}")

    # Clean up per-window results for JSON output (remove large arrays)
    clean_window_results = []
    for wr in final_results:
        clean_wr = {k: v for k, v in wr.items() if k not in ("y_test", "pred_test")}
        clean_window_results.append(clean_wr)

    return {
        "metrics": new_metrics,
        "version": "v2.0",
        "comparison": comparison,
        "per_window_results": clean_window_results,
        "feature_selection": {
            "initial_candidates": candidate_metrics,
            "after_elastic_net": selected,
            "after_stability_check": stable_features,
        },
        "stability_info": {
            k: {sk: sv for sk, sv in v.items() if sk != "values"}
            for k, v in stability_info.items()
        },
        "bootstrap": bootstrap_results,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="PropertyIQ Weight Optimization -- Walk-Forward Cross-Validation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python optimize_weights.py --score-type both
  python optimize_weights.py --score-type homeready --output-dir ./results
  python optimize_weights.py --score-type investoredge
        """,
    )
    parser.add_argument(
        "--score-type",
        choices=["homeready", "investoredge", "both"],
        default="both",
        help="Which score type(s) to optimize (default: both)",
    )
    parser.add_argument(
        "--geo-level",
        choices=["metro", "county", "zip", "all"],
        default="all",
        help="Geography level to optimize (default: all)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="output",
        help="Directory for output files (default: output/)",
    )

    args = parser.parse_args()

    # Resolve output directory relative to script location
    script_dir = Path(__file__).resolve().parent
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = script_dir / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    # Determine geo levels
    if args.geo_level == "all":
        geo_levels = ["metro", "county", "zip"]
    else:
        geo_levels = [args.geo_level]

    print("=" * 70)
    print("  PropertyIQ Weight Optimization")
    print(f"  Score type: {args.score_type}")
    print(f"  Geo levels: {', '.join(geo_levels)}")
    print(f"  Output dir: {output_dir}")
    print("=" * 70)

    # Connect to database
    conn = get_db_connection()

    try:
        score_types = (
            ["homeready", "investoredge"]
            if args.score_type == "both"
            else [args.score_type]
        )

        all_results = {}
        for geo_level in geo_levels:
            print(f"\n{'='*70}")
            print(f"  GEO LEVEL: {geo_level.upper()}")
            print(f"{'='*70}")

            results = {}
            for st in score_types:
                results[st] = optimize_score_type(conn, st, geo_level=geo_level)

            # Build output JSON for this geo level
            output = {
                "generated_at": datetime.utcnow().isoformat() + "Z",
                "geo_level": geo_level,
                "methodology": "walk_forward_elastic_net",
                "walk_forward_windows": [
                    {
                        "train": f"{ws[0]} to {ws[1]}",
                        "test": f"{ws[2]} to {ws[3]}",
                    }
                    for ws in WALK_FORWARD_WINDOWS
                ],
                "current_weights_v1": CURRENT_WEIGHTS,
            }

            for st in score_types:
                output[st] = results[st]

            if len(score_types) == 2:
                output["summary"] = {}
                for st in score_types:
                    if "comparison" in results[st]:
                        output["summary"][st] = results[st]["comparison"]

            # Write JSON per geo level
            output_file = output_dir / f"optimized_weights_{geo_level}.json"
            with open(output_file, "w") as f:
                json.dump(output, f, indent=2, default=str)
            print(f"\n[OUTPUT] Results written to: {output_file}")

            all_results[geo_level] = results

        # Final summary
        print("\n" + "=" * 70)
        print("  OPTIMIZATION COMPLETE")
        print("=" * 70)

        for geo_level in geo_levels:
            results = all_results[geo_level]
            for st in score_types:
                r = results[st]
                if "error" in r:
                    print(f"\n  {geo_level.upper()} / {st.upper()}: {r['error']}")
                    continue

                print(f"\n  {geo_level.upper()} / {st.upper()} v2.0 Formula:")
                for m in r.get("metrics", []):
                    dir_str = "+" if m["direction"] == 1 else "-"
                    print(f"    {m['name']:30s}  {m['weight']:.3f}  ({dir_str})")

                comp = r.get("comparison", {})
                if comp:
                    old_ic = comp.get("current_v1", {}).get("mean_ic")
                    new_ic = comp.get("proposed_v2", {}).get("mean_ic")
                    if old_ic is not None and new_ic is not None:
                        delta = new_ic - old_ic
                        print(f"    IC improvement: {old_ic:.4f} -> {new_ic:.4f} ({delta:+.4f})")

                bs = r.get("bootstrap", {})
                if bs.get("significant"):
                    print("    Bootstrap: SIGNIFICANT (quintile spread CI excludes 0)")
                elif bs.get("ci_lower") is not None:
                    print(
                        f"    Bootstrap: NOT significant "
                        f"(CI: [{bs['ci_lower']:.4f}, {bs['ci_upper']:.4f}])"
                    )

        print("=" * 70)

    finally:
        conn.close()
        print("\n[DB] Connection closed.")


if __name__ == "__main__":
    main()
