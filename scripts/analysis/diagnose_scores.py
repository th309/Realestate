#!/usr/bin/env python3
"""
PropertyIQ Diagnostic Analysis Script (Step 2)
===============================================
Analyzes how well current scoring formulas predict *excess returns*
(outperformance vs regional peers).

Steps implemented:
  2.1 - Data extraction from propertyiq_backtest_outcomes + propertyiq_scores
  2.2 - Information Coefficient (IC) analysis
  2.3 - Per-metric predictive power
  2.4 - Quintile spread on excess returns
  2.5 - Time-period stability
  2.6 - Direction error diagnosis
  2.7 - Normalization impact analysis

Usage:
  python diagnose_scores.py
  python diagnose_scores.py --score-type homeready
  python diagnose_scores.py --score-type investoredge --horizon 1y
  python diagnose_scores.py --score-type both --horizon 3y
"""

import argparse
import json
import logging
import os
import sys
import warnings
from collections import OrderedDict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy import stats

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SUPABASE_PROJECT_REF = "pysflbhpnqwoczyuaaif"

CURRENT_WEIGHTS = {
    "homeready": {
        "metrics": [
            {"name": "hotness_score", "weight": 0.706, "direction": 1},
            {"name": "pending_ratio", "weight": 0.152, "direction": 1},
            {"name": "unemployment_rate_yoy", "weight": 0.057, "direction": -1},
            {"name": "population_yoy", "weight": 0.054, "direction": -1},
            {"name": "demand_score", "weight": 0.031, "direction": 1},
        ],
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
    },
}

# All candidate metrics that might appear in z_scores JSONB
ALL_CANDIDATE_METRICS = [
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
    "rent_price_ratio",
    "median_gross_rent",
    "homeownership_rate",
    "zori_yoy",
]

# IC performance targets
IC_TARGET_MEAN = 0.10
IC_IR_TARGET = 0.50

# Quintile spread targets (percentage points)
QUINTILE_TOP_TARGET = 1.5
QUINTILE_BOTTOM_TARGET = -1.5


# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------

def get_db_connection():
    """
    Establish a PostgreSQL connection to the Supabase database.

    Tries in order:
      1. DATABASE_URL environment variable (direct connection string)
      2. SUPABASE_DB_PASSWORD with pooler connection (preferred)
      3. SUPABASE_URL + SUPABASE_SERVICE_KEY to construct a direct connection
    """
    import psycopg2

    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        logger.info("Connecting via DATABASE_URL ...")
        return psycopg2.connect(database_url)

    # Pooler connection (works when direct DB host has IPv6-only DNS)
    db_password = os.environ.get("SUPABASE_DB_PASSWORD", "IHatedoingpt12")
    pooler_host = "aws-1-us-east-1.pooler.supabase.com"
    ref = SUPABASE_PROJECT_REF
    conn_str = (
        f"host={pooler_host} port=6543 dbname=postgres "
        f"user=postgres.{ref} password={db_password} sslmode=require"
    )
    logger.info("Connecting to %s via pooler ...", pooler_host)
    return psycopg2.connect(conn_str)


def _get_sqlalchemy_url() -> str:
    """Build a SQLAlchemy-compatible URL from environment variables."""
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url

    from urllib.parse import quote_plus
    db_password = os.environ.get("SUPABASE_DB_PASSWORD", "IHatedoingpt12")
    ref = SUPABASE_PROJECT_REF
    pooler_host = "aws-1-us-east-1.pooler.supabase.com"
    return f"postgresql://postgres.{ref}:{quote_plus(db_password)}@{pooler_host}:6543/postgres?sslmode=require"


# ---------------------------------------------------------------------------
# 2.1  Data Extraction
# ---------------------------------------------------------------------------

def load_backtest_outcomes(conn_string: str, geo_level: str = "metro") -> pd.DataFrame:
    """
    Pull all backtest outcomes where score_value IS NOT NULL and at least
    one excess return column is not null.

    Args:
        geo_level: 'metro', 'county', 'zip', or 'all'
    """
    import sqlalchemy

    engine = sqlalchemy.create_engine(conn_string)

    geo_filter = ""
    if geo_level != "all":
        geo_filter = f"AND bo.geography_type = '{geo_level}'"

    query = f"""
    SELECT
        bo.geography_id,
        bo.geography_type,
        bo.score_type,
        bo.score_date,
        bo.score_value::float,
        bo.state_code,
        bo.outcome_1y_value::float  AS outcome_1y,
        bo.outcome_3y_value::float  AS outcome_3y,
        bo.excess_vs_state_1y::float,
        bo.excess_vs_state_3y::float,
        bo.excess_vs_national_1y::float,
        bo.excess_vs_national_3y::float,
        bo.rent_return_1y::float,
        bo.rent_return_3y_cagr::float,
        bo.state_rent_return_1y::float,
        bo.state_rent_return_3y_cagr::float,
        bo.national_rent_return_1y::float,
        bo.national_rent_return_3y_cagr::float,
        bo.outcome_metrics,
        cdm.division_id,
        cdm.division_name
    FROM propertyiq_backtest_outcomes bo
    LEFT JOIN census_division_mapping cdm
        ON bo.state_code = cdm.state_code
    WHERE bo.score_value IS NOT NULL
      {geo_filter}
      AND (
          bo.excess_vs_state_1y IS NOT NULL
          OR bo.excess_vs_state_3y IS NOT NULL
          OR bo.excess_vs_national_1y IS NOT NULL
          OR bo.excess_vs_national_3y IS NOT NULL
      )
    ORDER BY bo.score_type, bo.score_date, bo.geography_id
    """

    df = pd.read_sql(query, engine)
    engine.dispose()

    df["score_date"] = pd.to_datetime(df["score_date"])
    df["year"] = df["score_date"].dt.year

    # Compute total return columns (appreciation + rent yield)
    df["total_return_1y"] = np.where(
        df["outcome_1y"].notna() & df["rent_return_1y"].notna(),
        df["outcome_1y"] + df["rent_return_1y"],
        np.nan,
    )
    df["total_return_3y"] = np.where(
        df["outcome_3y"].notna() & df["rent_return_3y_cagr"].notna(),
        df["outcome_3y"] + df["rent_return_3y_cagr"],
        np.nan,
    )

    # Compute total-return excess vs state
    # excess_total_vs_state_1y = total_return_1y - state_total_return_1y
    df["state_total_return_1y"] = np.where(
        df["outcome_1y"].notna() & df["state_rent_return_1y"].notna(),
        # state_return (appreciation) is embedded in excess calculation;
        # approximate: metro_appreciation - excess = state_appreciation
        # Then state total = state_appreciation + state_rent
        (df["outcome_1y"] - df["excess_vs_state_1y"].fillna(0)) + df["state_rent_return_1y"],
        np.nan,
    )
    df["excess_total_vs_state_1y"] = np.where(
        df["total_return_1y"].notna() & df["state_total_return_1y"].notna(),
        df["total_return_1y"] - df["state_total_return_1y"],
        np.nan,
    )

    df["state_total_return_3y"] = np.where(
        df["outcome_3y"].notna() & df["state_rent_return_3y_cagr"].notna(),
        (df["outcome_3y"] - df["excess_vs_state_3y"].fillna(0)) + df["state_rent_return_3y_cagr"],
        np.nan,
    )
    df["excess_total_vs_state_3y"] = np.where(
        df["total_return_3y"].notna() & df["state_total_return_3y"].notna(),
        df["total_return_3y"] - df["state_total_return_3y"],
        np.nan,
    )

    logger.info(
        "Loaded %d outcome rows (%d homeready, %d investoredge)",
        len(df),
        (df["score_type"] == "homeready").sum(),
        (df["score_type"] == "investoredge").sum(),
    )
    return df


def load_z_scores(conn_string: str) -> pd.DataFrame:
    """
    Pull z_scores from propertyiq_scores for per-metric analysis.
    Falls back gracefully if the z_scores column does not yet exist.
    """
    import sqlalchemy

    engine = sqlalchemy.create_engine(conn_string)

    # First check if z_scores column exists
    check_query = """
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'propertyiq_scores'
      AND column_name = 'z_scores'
    """
    exists_df = pd.read_sql(check_query, engine)

    if exists_df.empty:
        logger.warning(
            "z_scores column not found in propertyiq_scores. "
            "Per-metric analysis will use raw_score or be limited."
        )
        # Try alternative: look for z-scores in propertyiq_score_history
        alt_query = """
        SELECT
            geography_id AS location_id,
            geography_type AS geography_level,
            period_date,
            'homeready' AS score_type,
            homeready_components AS z_scores
        FROM propertyiq_score_history
        WHERE homeready_components IS NOT NULL
        UNION ALL
        SELECT
            geography_id AS location_id,
            geography_type AS geography_level,
            period_date,
            'investoredge' AS score_type,
            investoredge_components AS z_scores
        FROM propertyiq_score_history
        WHERE investoredge_components IS NOT NULL
        """
        try:
            alt_df = pd.read_sql(alt_query, engine)
            if not alt_df.empty:
                logger.info(
                    "Found %d rows with component z-scores from score_history",
                    len(alt_df),
                )
                alt_df["period_date"] = pd.to_datetime(alt_df["period_date"])
                engine.dispose()
                return alt_df
        except Exception as e:
            logger.warning("Could not load from score_history: %s", e)

        engine.dispose()
        return pd.DataFrame()

    # z_scores column exists
    query = """
    SELECT
        location_id,
        geography AS geography_level,
        score_type,
        score_date AS period_date,
        z_scores
    FROM propertyiq_scores
    WHERE z_scores IS NOT NULL
    ORDER BY score_type, score_date, location_id
    """
    # Fallback: try with the exact column names from the schema
    try:
        df = pd.read_sql(query, engine)
    except Exception:
        query_alt = """
        SELECT
            location_id,
            geography AS geography_level,
            score_type,
            score_date AS period_date,
            raw_score,
            z_scores
        FROM propertyiq_scores
        WHERE z_scores IS NOT NULL
        ORDER BY score_type, score_date, location_id
        """
        try:
            df = pd.read_sql(query_alt, engine)
        except Exception as e2:
            logger.warning("Could not load z_scores: %s", e2)
            engine.dispose()
            return pd.DataFrame()

    engine.dispose()
    df["period_date"] = pd.to_datetime(df["period_date"])
    logger.info("Loaded %d rows with z_scores from propertyiq_scores", len(df))
    return df


def expand_z_scores(df_z: pd.DataFrame) -> pd.DataFrame:
    """
    Expand the z_scores JSONB column into individual metric columns.
    Returns a DataFrame with one column per metric z-score.
    """
    if df_z.empty or "z_scores" not in df_z.columns:
        return df_z

    # Parse JSON if stored as string
    def safe_parse(val):
        if val is None:
            return {}
        if isinstance(val, dict):
            return val
        if isinstance(val, str):
            try:
                return json.loads(val)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}

    z_expanded = df_z["z_scores"].apply(safe_parse).apply(pd.Series)
    # Prefix columns with 'z_' for clarity
    z_expanded.columns = [f"z_{c}" if not c.startswith("z_") else c for c in z_expanded.columns]

    result = pd.concat([df_z.drop(columns=["z_scores"]), z_expanded], axis=1)
    return result


# ---------------------------------------------------------------------------
# Target column selection
# ---------------------------------------------------------------------------

def get_target_col(score_type: str, horizon: str) -> str:
    """
    Return the primary excess-return column for a given score type and horizon.

    HomeReady -> appreciation excess vs state (Census Division)
    InvestorEdge -> total return excess vs state (if available), else appreciation excess
    """
    if score_type == "homeready":
        if horizon == "1y":
            return "excess_vs_state_1y"
        return "excess_vs_state_3y"
    elif score_type == "investoredge":
        # Prefer total return excess for InvestorEdge
        if horizon == "1y":
            return "excess_total_vs_state_1y"
        return "excess_total_vs_state_3y"
    else:
        raise ValueError(f"Unknown score type: {score_type}")


def get_fallback_target_col(score_type: str, horizon: str) -> str:
    """Fallback to appreciation-only excess if total return excess is sparse."""
    if horizon == "1y":
        return "excess_vs_state_1y"
    return "excess_vs_state_3y"


# ---------------------------------------------------------------------------
# 2.2  Information Coefficient (IC) Analysis
# ---------------------------------------------------------------------------

def compute_ic_per_period(
    df_sub: pd.DataFrame, target: str
) -> List[Dict[str, Any]]:
    """
    For each score_date, compute cross-sectional Spearman rank correlation
    between score_value and subsequent excess return.
    Returns list of per-period IC records.
    """
    ic_records = []
    for date_val, grp in df_sub.groupby("score_date"):
        valid = grp.dropna(subset=["score_value", target])
        if len(valid) < 10:
            continue
        try:
            corr, pval = stats.spearmanr(valid["score_value"].values, valid[target].values)
            if np.isfinite(corr):
                ic_records.append({
                    "score_date": str(date_val.date()) if hasattr(date_val, "date") else str(date_val),
                    "ic": float(corr),
                    "p_value": float(pval),
                    "n_metros": len(valid),
                })
        except Exception:
            pass
    return ic_records


def summarize_ic(ic_records: List[Dict]) -> Dict[str, Any]:
    """Summarize IC statistics across periods."""
    if not ic_records:
        return {
            "mean_ic": 0.0,
            "std_ic": 0.0,
            "ic_information_ratio": 0.0,
            "ic_hit_rate_pct": 0.0,
            "n_periods": 0,
            "meets_mean_target": False,
            "meets_ir_target": False,
        }

    ics = np.array([r["ic"] for r in ic_records])
    mean_ic = float(np.mean(ics))
    std_ic = float(np.std(ics, ddof=1)) if len(ics) > 1 else 0.0
    ir = mean_ic / std_ic if std_ic > 0 else 0.0
    hit_rate = float((ics > 0).sum() / len(ics) * 100)

    return {
        "mean_ic": round(mean_ic, 4),
        "std_ic": round(std_ic, 4),
        "ic_information_ratio": round(ir, 4),
        "ic_hit_rate_pct": round(hit_rate, 1),
        "n_periods": len(ic_records),
        "meets_mean_target": mean_ic > IC_TARGET_MEAN,
        "meets_ir_target": ir > IC_IR_TARGET,
        "target_mean_ic": IC_TARGET_MEAN,
        "target_ir": IC_IR_TARGET,
    }


def run_ic_analysis(
    df: pd.DataFrame, score_type: str, target: str
) -> Dict[str, Any]:
    """Step 2.2: Full IC analysis for one score type."""
    logger.info("[2.2] Running IC analysis for %s (target=%s)", score_type, target)

    df_sub = df[df["score_type"] == score_type].copy()
    ic_records = compute_ic_per_period(df_sub, target)
    summary = summarize_ic(ic_records)
    summary["per_period_ic"] = ic_records

    return summary


# ---------------------------------------------------------------------------
# 2.3  Per-Metric Predictive Power
# ---------------------------------------------------------------------------

def run_per_metric_analysis(
    df_outcomes: pd.DataFrame,
    df_z: pd.DataFrame,
    score_type: str,
    target: str,
) -> Dict[str, Any]:
    """
    Step 2.3: For each metric in the formula z_scores, compute rank correlation
    between that metric's z-score and subsequent excess return.
    """
    logger.info("[2.3] Running per-metric predictive power for %s", score_type)

    formula_metrics = CURRENT_WEIGHTS.get(score_type, {}).get("metrics", [])
    formula_metric_names = {m["name"] for m in formula_metrics}
    formula_direction = {m["name"]: m["direction"] for m in formula_metrics}
    formula_weight = {m["name"]: m["weight"] for m in formula_metrics}

    results = {
        "formula_metrics": [],
        "non_formula_metrics": [],
        "wrong_direction_metrics": [],
        "zero_signal_metrics": [],
        "missing_strong_signals": [],
    }

    if df_z.empty:
        logger.warning("No z-score data available. Per-metric analysis will be limited.")
        results["error"] = "no_z_score_data"
        return results

    # Merge z-scores with outcomes
    df_sub = df_outcomes[df_outcomes["score_type"] == score_type].copy()

    # Try to match on geography_id/location_id and score_date/period_date
    merged = pd.merge(
        df_sub,
        df_z[df_z["score_type"] == score_type] if "score_type" in df_z.columns else df_z,
        left_on=["geography_id", "score_date"],
        right_on=["location_id", "period_date"],
        how="inner",
        suffixes=("", "_z"),
    )

    if merged.empty:
        logger.warning("No matched z-score data for %s. Skipping per-metric analysis.", score_type)
        results["error"] = "no_matched_data"
        return results

    logger.info("Matched %d rows with z-scores for per-metric analysis", len(merged))

    # Find all z-score columns
    z_cols = [c for c in merged.columns if c.startswith("z_")]
    metric_names_from_data = [c.replace("z_", "", 1) for c in z_cols]

    # Analyze each metric
    all_metric_results = []
    for z_col, metric_name in zip(z_cols, metric_names_from_data):
        valid = merged.dropna(subset=[z_col, target])
        if len(valid) < 20:
            continue

        # Overall correlation
        try:
            corr, pval = stats.spearmanr(valid[z_col].values, valid[target].values)
            corr = float(corr) if np.isfinite(corr) else 0.0
            pval = float(pval) if np.isfinite(pval) else 1.0
        except Exception:
            corr, pval = 0.0, 1.0

        # Per-period IC for this metric
        period_ics = []
        for _, grp in valid.groupby("score_date"):
            if len(grp) < 10:
                continue
            try:
                r, _ = stats.spearmanr(grp[z_col].values, grp[target].values)
                if np.isfinite(r):
                    period_ics.append(float(r))
            except Exception:
                pass

        mean_period_ic = float(np.mean(period_ics)) if period_ics else 0.0
        ic_hit_rate = float((np.array(period_ics) > 0).sum() / len(period_ics) * 100) if period_ics else 0.0

        is_in_formula = metric_name in formula_metric_names
        formula_dir = formula_direction.get(metric_name, None)
        current_weight = formula_weight.get(metric_name, 0.0)

        # Empirical direction: sign of correlation
        empirical_direction = 1 if corr > 0 else (-1 if corr < 0 else 0)

        # Direction agreement
        direction_agrees = (
            formula_dir is not None and
            (formula_dir * empirical_direction > 0)
        ) if formula_dir is not None else None

        metric_result = {
            "metric": metric_name,
            "in_formula": is_in_formula,
            "current_weight": current_weight,
            "current_direction": formula_dir,
            "spearman_r_overall": round(corr, 4),
            "p_value": round(pval, 6),
            "mean_period_ic": round(mean_period_ic, 4),
            "ic_hit_rate_pct": round(ic_hit_rate, 1),
            "n_periods": len(period_ics),
            "n_observations": len(valid),
            "empirical_direction": empirical_direction,
            "direction_agrees": direction_agrees,
            "signal_strength": "strong" if abs(corr) > 0.15 else ("moderate" if abs(corr) > 0.05 else "weak"),
        }
        all_metric_results.append(metric_result)

    # Sort by absolute correlation strength
    all_metric_results.sort(key=lambda x: abs(x["spearman_r_overall"]), reverse=True)

    # Categorize
    for m in all_metric_results:
        if m["in_formula"]:
            results["formula_metrics"].append(m)
            if m["direction_agrees"] is False:
                results["wrong_direction_metrics"].append(m)
            if abs(m["spearman_r_overall"]) < 0.02 and abs(m["mean_period_ic"]) < 0.02:
                results["zero_signal_metrics"].append(m)
        else:
            results["non_formula_metrics"].append(m)
            if abs(m["spearman_r_overall"]) > 0.10:
                results["missing_strong_signals"].append(m)

    results["all_metrics_ranked"] = all_metric_results

    return results


# ---------------------------------------------------------------------------
# 2.4  Quintile Spread on Excess Returns
# ---------------------------------------------------------------------------

def compute_quintile_spread(
    scores: np.ndarray, returns: np.ndarray, label: str = ""
) -> Dict[str, Any]:
    """
    Divide metros into quintiles by score, compute average return per quintile.
    """
    try:
        labels = pd.qcut(scores, 5, labels=False, duplicates="drop") + 1
    except ValueError:
        labels = pd.Series(scores).rank(method="first", pct=True)
        labels = np.ceil(labels * 5).astype(int).clip(1, 5).values

    quintile_rows = []
    for q in sorted(set(labels)):
        mask = labels == q
        q_returns = returns[mask]
        quintile_rows.append({
            "quintile": int(q),
            "avg_return": round(float(np.mean(q_returns)), 4),
            "median_return": round(float(np.median(q_returns)), 4),
            "std_return": round(float(np.std(q_returns)), 4),
            "count": int(mask.sum()),
            "pct_positive": round(float((q_returns > 0).sum() / len(q_returns) * 100), 1),
        })

    top_avg = quintile_rows[-1]["avg_return"] if quintile_rows else 0.0
    bot_avg = quintile_rows[0]["avg_return"] if quintile_rows else 0.0
    spread = top_avg - bot_avg

    return {
        "label": label,
        "quintiles": quintile_rows,
        "top_quintile_avg": top_avg,
        "bottom_quintile_avg": bot_avg,
        "quintile_spread": round(spread, 4),
        "monotonic": _check_monotonicity(quintile_rows),
    }


def _check_monotonicity(quintile_rows: List[Dict]) -> Dict[str, Any]:
    """Check if quintile average returns are monotonically increasing."""
    avgs = [r["avg_return"] for r in quintile_rows]
    if len(avgs) < 2:
        return {"is_monotonic": False, "violations": 0, "direction_score": 0}

    violations = 0
    for i in range(1, len(avgs)):
        if avgs[i] < avgs[i - 1]:
            violations += 1

    n_pairs = len(avgs) - 1
    direction_score = round(1.0 - violations / n_pairs, 2) if n_pairs > 0 else 0

    return {
        "is_monotonic": violations == 0,
        "violations": violations,
        "direction_score": direction_score,
    }


def run_quintile_analysis(
    df: pd.DataFrame, score_type: str, target: str
) -> Dict[str, Any]:
    """Step 2.4: Quintile spread analysis comparing raw vs excess returns."""
    logger.info("[2.4] Running quintile spread analysis for %s", score_type)

    df_sub = df[df["score_type"] == score_type].copy()
    valid = df_sub.dropna(subset=["score_value", target])

    if len(valid) < 50:
        return {"error": f"Insufficient data (n={len(valid)})"}

    scores = valid["score_value"].values

    # Quintile spread on excess returns (primary)
    excess_returns = valid[target].values
    excess_result = compute_quintile_spread(scores, excess_returns, label="excess_returns")

    # Quintile spread on raw returns for comparison
    raw_col = "outcome_3y" if "3y" in target else "outcome_1y"
    raw_valid = valid.dropna(subset=[raw_col])
    raw_result = {}
    if len(raw_valid) > 50:
        raw_result = compute_quintile_spread(
            raw_valid["score_value"].values,
            raw_valid[raw_col].values,
            label="raw_returns",
        )

    # Quintile spread on national excess for comparison
    nat_col = target.replace("_vs_state_", "_vs_national_").replace("_total_vs_state_", "_vs_national_")
    nat_valid = valid.dropna(subset=[nat_col]) if nat_col in valid.columns else pd.DataFrame()
    national_result = {}
    if len(nat_valid) > 50:
        national_result = compute_quintile_spread(
            nat_valid["score_value"].values,
            nat_valid[nat_col].values,
            label="excess_vs_national",
        )

    # Target assessment
    top_target_met = excess_result["top_quintile_avg"] > QUINTILE_TOP_TARGET
    bottom_target_met = excess_result["bottom_quintile_avg"] < QUINTILE_BOTTOM_TARGET

    return {
        "excess_returns": excess_result,
        "raw_returns": raw_result,
        "national_excess": national_result,
        "target_assessment": {
            "top_quintile_target": QUINTILE_TOP_TARGET,
            "bottom_quintile_target": QUINTILE_BOTTOM_TARGET,
            "top_quintile_actual": excess_result["top_quintile_avg"],
            "bottom_quintile_actual": excess_result["bottom_quintile_avg"],
            "top_target_met": top_target_met,
            "bottom_target_met": bottom_target_met,
            "both_targets_met": top_target_met and bottom_target_met,
        },
        "n": len(valid),
    }


# ---------------------------------------------------------------------------
# 2.5  Time-Period Stability
# ---------------------------------------------------------------------------

def run_time_stability(
    df: pd.DataFrame, score_type: str, target: str
) -> Dict[str, Any]:
    """
    Step 2.5: Split into sub-periods (2021, 2022, 2023, 2024),
    compute IC and quintile spread per period, identify regime breaks.
    """
    logger.info("[2.5] Running time-period stability for %s", score_type)

    df_sub = df[df["score_type"] == score_type].copy()
    years = sorted(df_sub["year"].dropna().unique().astype(int).tolist())

    period_results = []
    ic_by_year = {}
    spread_by_year = {}
    failures = []

    for yr in years:
        yr_df = df_sub[df_sub["year"] == yr].dropna(subset=["score_value", target])
        n = len(yr_df)
        if n < 20:
            period_results.append({"year": yr, "n": n, "skipped": True})
            continue

        # IC per period within this year
        ic_vals = []
        for _, grp in yr_df.groupby("score_date"):
            if len(grp) < 10:
                continue
            try:
                sr, _ = stats.spearmanr(grp["score_value"].values, grp[target].values)
                if np.isfinite(sr):
                    ic_vals.append(float(sr))
            except Exception:
                pass

        mean_ic = float(np.mean(ic_vals)) if ic_vals else 0.0
        std_ic = float(np.std(ic_vals, ddof=1)) if len(ic_vals) > 1 else 0.0

        # Quintile spread for this year
        scores = yr_df["score_value"].values
        excess = yr_df[target].values
        q_result = compute_quintile_spread(scores, excess, label=f"year_{yr}")
        qspread = q_result["quintile_spread"]

        # Regime break detection
        failed = mean_ic < 0 or qspread < 0
        if failed:
            failures.append(str(yr))

        ic_by_year[yr] = mean_ic
        spread_by_year[yr] = qspread

        period_results.append({
            "year": yr,
            "n": n,
            "n_periods": len(ic_vals),
            "mean_ic": round(mean_ic, 4),
            "std_ic": round(std_ic, 4),
            "quintile_spread": round(qspread, 4),
            "top_quintile_avg": q_result["top_quintile_avg"],
            "bottom_quintile_avg": q_result["bottom_quintile_avg"],
            "monotonic": q_result["monotonic"]["is_monotonic"],
            "failed": failed,
        })

    # Detect regime breaks: sign change or large magnitude change in IC
    regime_breaks = []
    active_years = [r for r in period_results if not r.get("skipped", False)]
    for i in range(1, len(active_years)):
        prev_ic = active_years[i - 1].get("mean_ic", 0)
        curr_ic = active_years[i].get("mean_ic", 0)
        if prev_ic * curr_ic < 0:  # sign change
            regime_breaks.append({
                "between": f"{active_years[i-1]['year']}-{active_years[i]['year']}",
                "type": "ic_sign_flip",
                "prev_ic": prev_ic,
                "curr_ic": curr_ic,
            })
        elif abs(curr_ic - prev_ic) > 0.15:  # large magnitude change
            regime_breaks.append({
                "between": f"{active_years[i-1]['year']}-{active_years[i]['year']}",
                "type": "large_ic_shift",
                "prev_ic": prev_ic,
                "curr_ic": curr_ic,
                "delta": round(curr_ic - prev_ic, 4),
            })

    return {
        "by_year": period_results,
        "failure_years": failures,
        "all_years_pass": len(failures) == 0,
        "regime_breaks": regime_breaks,
        "ic_trend": {
            "years": list(ic_by_year.keys()),
            "ics": [round(v, 4) for v in ic_by_year.values()],
        },
    }


# ---------------------------------------------------------------------------
# 2.6  Direction Error Diagnosis
# ---------------------------------------------------------------------------

def test_direction_hypothesis(
    df: pd.DataFrame,
    df_z: pd.DataFrame,
    score_type: str,
    metric_name: str,
    hypothesis: str,
    appreciation_target: str,
    total_return_target: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Test a specific direction hypothesis for a metric.
    Computes correlation with both appreciation and total return excess.
    """
    df_sub = df[df["score_type"] == score_type].copy()

    result = {
        "metric": metric_name,
        "score_type": score_type,
        "hypothesis": hypothesis,
        "appreciation_correlation": None,
        "total_return_correlation": None,
        "conclusion": "",
    }

    if df_z.empty:
        result["error"] = "no_z_score_data"
        return result

    # Merge
    z_sub = df_z[df_z["score_type"] == score_type] if "score_type" in df_z.columns else df_z
    merged = pd.merge(
        df_sub, z_sub,
        left_on=["geography_id", "score_date"],
        right_on=["location_id", "period_date"],
        how="inner",
        suffixes=("", "_z"),
    )

    z_col = f"z_{metric_name}"
    if z_col not in merged.columns:
        result["error"] = f"z-score column {z_col} not found in merged data"
        return result

    # Test vs appreciation excess
    valid_appr = merged.dropna(subset=[z_col, appreciation_target])
    if len(valid_appr) >= 20:
        try:
            corr, pval = stats.spearmanr(valid_appr[z_col].values, valid_appr[appreciation_target].values)
            result["appreciation_correlation"] = {
                "spearman_r": round(float(corr), 4) if np.isfinite(corr) else 0.0,
                "p_value": round(float(pval), 6) if np.isfinite(pval) else 1.0,
                "n": len(valid_appr),
                "implied_direction": 1 if corr > 0 else -1,
            }
        except Exception:
            pass

    # Test vs total return excess (if applicable)
    if total_return_target and total_return_target in merged.columns:
        valid_tr = merged.dropna(subset=[z_col, total_return_target])
        if len(valid_tr) >= 20:
            try:
                corr, pval = stats.spearmanr(valid_tr[z_col].values, valid_tr[total_return_target].values)
                result["total_return_correlation"] = {
                    "spearman_r": round(float(corr), 4) if np.isfinite(corr) else 0.0,
                    "p_value": round(float(pval), 6) if np.isfinite(pval) else 1.0,
                    "n": len(valid_tr),
                    "implied_direction": 1 if corr > 0 else -1,
                }
            except Exception:
                pass

    # Conclusion
    appr_dir = (result.get("appreciation_correlation") or {}).get("implied_direction")
    tr_dir = (result.get("total_return_correlation") or {}).get("implied_direction")

    if appr_dir is not None and tr_dir is not None and appr_dir != tr_dir:
        result["conclusion"] = (
            f"SPLIT SIGNAL: {metric_name} predicts appreciation in direction={appr_dir} "
            f"but total return in direction={tr_dir}. "
            "The current direction assignment may be correct for one target but wrong for the other."
        )
    elif appr_dir is not None:
        formula_dir = {m["name"]: m["direction"] for m in CURRENT_WEIGHTS.get(score_type, {}).get("metrics", [])}.get(metric_name)
        if formula_dir is not None and formula_dir != appr_dir:
            result["conclusion"] = (
                f"WRONG DIRECTION: {metric_name} has formula direction={formula_dir} "
                f"but empirical direction={appr_dir} for predicting excess returns."
            )
        else:
            result["conclusion"] = (
                f"Direction appears correct (empirical={appr_dir}, formula={formula_dir})."
            )
    else:
        result["conclusion"] = "Insufficient data to determine direction."

    return result


def run_direction_diagnosis(
    df: pd.DataFrame, df_z: pd.DataFrame, horizon: str
) -> Dict[str, Any]:
    """
    Step 2.6: Test specific direction hypotheses.
    """
    logger.info("[2.6] Running direction error diagnosis")

    appr_1y = "excess_vs_state_1y"
    appr_3y = "excess_vs_state_3y"
    tr_1y = "excess_total_vs_state_1y"
    tr_3y = "excess_total_vs_state_3y"

    appr_target = appr_1y if horizon == "1y" else appr_3y
    tr_target = tr_1y if horizon == "1y" else tr_3y

    hypotheses = []

    # H1: median_gross_rent direction=-1 in InvestorEdge
    hypotheses.append(test_direction_hypothesis(
        df, df_z,
        score_type="investoredge",
        metric_name="median_gross_rent",
        hypothesis=(
            "median_gross_rent has direction=-1 in InvestorEdge. This means lower-rent "
            "markets get higher scores. This is correct for appreciation (cheap markets "
            "appreciate more) but potentially wrong for total return (higher rent = "
            "higher yield = higher total return)."
        ),
        appreciation_target=appr_target,
        total_return_target=tr_target,
    ))

    # H2: population_yoy direction=-1
    hypotheses.append(test_direction_hypothesis(
        df, df_z,
        score_type="homeready",
        metric_name="population_yoy",
        hypothesis=(
            "population_yoy has direction=-1 in HomeReady. This is counterintuitive "
            "as growing populations should drive demand. Possible explanation: "
            "population growth is already priced in, and high-growth areas are overvalued."
        ),
        appreciation_target=appr_target,
    ))

    hypotheses.append(test_direction_hypothesis(
        df, df_z,
        score_type="investoredge",
        metric_name="population_yoy",
        hypothesis=(
            "population_yoy has direction=-1 in InvestorEdge. Same counterintuitive "
            "assignment as HomeReady."
        ),
        appreciation_target=appr_target,
        total_return_target=tr_target,
    ))

    # H3: affordability_ratio direction=-1 in InvestorEdge
    hypotheses.append(test_direction_hypothesis(
        df, df_z,
        score_type="investoredge",
        metric_name="affordability_ratio",
        hypothesis=(
            "affordability_ratio has direction=-1 in InvestorEdge. This means more "
            "affordable (cheaper relative to income) markets get higher scores. "
            "Test: are cheap markets actually better for investors when measured by "
            "excess returns?"
        ),
        appreciation_target=appr_target,
        total_return_target=tr_target,
    ))

    return {"hypotheses": hypotheses}


# ---------------------------------------------------------------------------
# 2.7  Normalization Impact
# ---------------------------------------------------------------------------

def run_normalization_impact(
    df: pd.DataFrame,
    df_z: pd.DataFrame,
    score_type: str,
    target: str,
) -> Dict[str, Any]:
    """
    Step 2.7: Compare correlation of raw weighted sum vs min-max normalized
    score against excess return. Quantify if min-max normalization destroys signal.
    """
    logger.info("[2.7] Running normalization impact analysis for %s", score_type)

    df_sub = df[df["score_type"] == score_type].copy()

    if df_z.empty:
        return {"error": "no_z_score_data", "summary": "Cannot assess normalization without z-score data."}

    z_sub = df_z[df_z["score_type"] == score_type] if "score_type" in df_z.columns else df_z
    merged = pd.merge(
        df_sub, z_sub,
        left_on=["geography_id", "score_date"],
        right_on=["location_id", "period_date"],
        how="inner",
        suffixes=("", "_z"),
    )

    if merged.empty:
        return {"error": "no_matched_data", "summary": "No data matched for normalization analysis."}

    formula_metrics = CURRENT_WEIGHTS.get(score_type, {}).get("metrics", [])

    # Reconstruct raw weighted sum from z-scores
    merged["raw_weighted_sum"] = 0.0
    metrics_found = 0
    for m in formula_metrics:
        z_col = f"z_{m['name']}"
        if z_col in merged.columns:
            merged["raw_weighted_sum"] += m["direction"] * m["weight"] * merged[z_col].fillna(0)
            metrics_found += 1

    if metrics_found == 0:
        return {
            "error": "no_z_score_columns_matched",
            "summary": "None of the formula metric z-scores were found in the data.",
        }

    # Min-max normalize the raw weighted sum (per score_date cross-section)
    def minmax_normalize(grp):
        vals = grp["raw_weighted_sum"]
        mn, mx = vals.min(), vals.max()
        if mx > mn:
            grp["minmax_score"] = ((vals - mn) / (mx - mn)) * 100
        else:
            grp["minmax_score"] = 50.0
        return grp

    _score_date_backup = merged["score_date"].copy()
    merged = merged.groupby("score_date", group_keys=False).apply(minmax_normalize)
    merged["score_date"] = _score_date_backup

    valid = merged.dropna(subset=["raw_weighted_sum", "minmax_score", "score_value", target])

    if len(valid) < 30:
        return {"error": "insufficient_data", "n": len(valid)}

    # Correlations: raw weighted sum vs excess return
    try:
        corr_raw, pval_raw = stats.spearmanr(valid["raw_weighted_sum"].values, valid[target].values)
        corr_raw = float(corr_raw) if np.isfinite(corr_raw) else 0.0
    except Exception:
        corr_raw, pval_raw = 0.0, 1.0

    # Correlations: min-max normalized vs excess return
    try:
        corr_minmax, pval_minmax = stats.spearmanr(valid["minmax_score"].values, valid[target].values)
        corr_minmax = float(corr_minmax) if np.isfinite(corr_minmax) else 0.0
    except Exception:
        corr_minmax, pval_minmax = 0.0, 1.0

    # Correlations: actual stored score_value vs excess return
    try:
        corr_stored, pval_stored = stats.spearmanr(valid["score_value"].values, valid[target].values)
        corr_stored = float(corr_stored) if np.isfinite(corr_stored) else 0.0
    except Exception:
        corr_stored, pval_stored = 0.0, 1.0

    signal_loss_pct = 0.0
    if abs(corr_raw) > 0:
        signal_loss_pct = round((1 - abs(corr_minmax) / abs(corr_raw)) * 100, 1)

    # Per-period comparison
    period_comparisons = []
    for date_val, grp in valid.groupby("score_date"):
        if len(grp) < 10:
            continue
        try:
            r_raw, _ = stats.spearmanr(grp["raw_weighted_sum"].values, grp[target].values)
            r_mm, _ = stats.spearmanr(grp["minmax_score"].values, grp[target].values)
            r_stored, _ = stats.spearmanr(grp["score_value"].values, grp[target].values)
            period_comparisons.append({
                "score_date": str(date_val.date()) if hasattr(date_val, "date") else str(date_val),
                "ic_raw": round(float(r_raw), 4) if np.isfinite(r_raw) else 0.0,
                "ic_minmax": round(float(r_mm), 4) if np.isfinite(r_mm) else 0.0,
                "ic_stored": round(float(r_stored), 4) if np.isfinite(r_stored) else 0.0,
            })
        except Exception:
            pass

    summary = (
        f"Raw weighted sum correlation: {corr_raw:.4f}, "
        f"Min-max normalized: {corr_minmax:.4f}, "
        f"Stored score: {corr_stored:.4f}. "
    )
    if signal_loss_pct > 5:
        summary += f"Min-max normalization appears to LOSE {signal_loss_pct:.1f}% of signal."
    elif signal_loss_pct < -5:
        summary += f"Min-max normalization actually IMPROVES signal by {-signal_loss_pct:.1f}%."
    else:
        summary += "Min-max normalization has minimal impact on signal quality."

    return {
        "n": len(valid),
        "metrics_matched": metrics_found,
        "total_formula_metrics": len(formula_metrics),
        "correlation_raw_weighted_sum": round(corr_raw, 4),
        "correlation_minmax_normalized": round(corr_minmax, 4),
        "correlation_stored_score": round(corr_stored, 4),
        "signal_loss_pct": signal_loss_pct,
        "destroys_signal": signal_loss_pct > 10,
        "period_comparisons": period_comparisons,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# Console output formatting
# ---------------------------------------------------------------------------

def print_divider(char: str = "=", width: int = 76) -> None:
    print(char * width)


def print_header(title: str) -> None:
    print()
    print_divider()
    print(f"  {title}")
    print_divider()
    print()


def print_table(headers: List[str], rows: List[List[str]], col_widths: Optional[List[int]] = None) -> None:
    """Print a formatted ASCII table."""
    if not rows:
        print("  (no data)")
        return

    if col_widths is None:
        col_widths = []
        for i, h in enumerate(headers):
            max_w = len(h)
            for row in rows:
                if i < len(row):
                    max_w = max(max_w, len(str(row[i])))
            col_widths.append(min(max_w + 2, 30))

    # Header
    header_line = "  "
    sep_line = "  "
    for i, h in enumerate(headers):
        w = col_widths[i] if i < len(col_widths) else 15
        header_line += h.ljust(w)
        sep_line += "-" * w
    print(header_line)
    print(sep_line)

    # Rows
    for row in rows:
        line = "  "
        for i, val in enumerate(row):
            w = col_widths[i] if i < len(col_widths) else 15
            line += str(val).ljust(w)
        print(line)


def print_ic_summary(ic_data: Dict, score_type: str) -> None:
    """Print IC analysis summary."""
    print(f"\n  --- {score_type.upper()} Information Coefficient ---")
    print()

    headers = ["Metric", "Value", "Target", "Status"]
    rows = [
        ["Mean IC", f"{ic_data['mean_ic']:.4f}", f"> {IC_TARGET_MEAN}",
         "PASS" if ic_data.get("meets_mean_target") else "FAIL"],
        ["Std IC", f"{ic_data['std_ic']:.4f}", "", ""],
        ["IC Info Ratio", f"{ic_data['ic_information_ratio']:.4f}", f"> {IC_IR_TARGET}",
         "PASS" if ic_data.get("meets_ir_target") else "FAIL"],
        ["IC Hit Rate", f"{ic_data['ic_hit_rate_pct']:.1f}%", "> 50%",
         "PASS" if ic_data["ic_hit_rate_pct"] > 50 else "FAIL"],
        ["# Periods", str(ic_data["n_periods"]), "", ""],
    ]
    print_table(headers, rows, [18, 12, 12, 8])


def print_quintile_table(q_data: Dict, label: str) -> None:
    """Print quintile spread table."""
    quintiles = q_data.get("quintiles", [])
    if not quintiles:
        return

    print(f"\n  --- {label} ---")
    print()
    headers = ["Quintile", "Avg Return", "Median", "Std", "Count", "% > 0"]
    rows = []
    for q in quintiles:
        rows.append([
            f"Q{q['quintile']}",
            f"{q['avg_return']:.4f}",
            f"{q['median_return']:.4f}",
            f"{q['std_return']:.4f}",
            str(q["count"]),
            f"{q['pct_positive']:.1f}%",
        ])

    print_table(headers, rows, [10, 12, 12, 10, 8, 10])

    spread = q_data.get("quintile_spread", 0)
    mono = q_data.get("monotonic", {})
    print(f"\n  Quintile Spread (Q5-Q1): {spread:.4f}")
    print(f"  Monotonic: {'Yes' if mono.get('is_monotonic') else 'No'} "
          f"(direction score: {mono.get('direction_score', 0):.2f})")


def print_stability_table(stab_data: Dict, score_type: str) -> None:
    """Print time stability table."""
    by_year = stab_data.get("by_year", [])
    if not by_year:
        return

    print(f"\n  --- {score_type.upper()} Time Stability ---")
    print()
    headers = ["Year", "N", "# Periods", "Mean IC", "Q-Spread", "Monotonic", "Status"]
    rows = []
    for yr in by_year:
        if yr.get("skipped"):
            rows.append([str(yr["year"]), str(yr["n"]), "-", "-", "-", "-", "SKIP"])
        else:
            rows.append([
                str(yr["year"]),
                str(yr["n"]),
                str(yr.get("n_periods", 0)),
                f"{yr.get('mean_ic', 0):.4f}",
                f"{yr.get('quintile_spread', 0):.4f}",
                "Y" if yr.get("monotonic") else "N",
                "FAIL" if yr.get("failed") else "PASS",
            ])
    print_table(headers, rows, [8, 8, 10, 10, 10, 10, 8])


def print_per_metric_table(metric_data: Dict, score_type: str) -> None:
    """Print per-metric predictive power."""
    all_metrics = metric_data.get("all_metrics_ranked", [])
    if not all_metrics:
        if metric_data.get("error"):
            print(f"\n  Per-metric analysis not available: {metric_data['error']}")
        return

    print(f"\n  --- {score_type.upper()} Per-Metric Predictive Power ---")
    print()
    headers = ["Metric", "In Formula", "Weight", "Dir", "Empirical", "Spearman r", "Signal", "Match"]
    rows = []
    for m in all_metrics:
        dir_str = f"{m['current_direction']:+d}" if m['current_direction'] is not None else "-"
        emp_str = f"{m['empirical_direction']:+d}" if m['empirical_direction'] != 0 else "0"
        match_str = ""
        if m["direction_agrees"] is True:
            match_str = "OK"
        elif m["direction_agrees"] is False:
            match_str = "WRONG"
        else:
            match_str = "-"

        rows.append([
            m["metric"],
            "Y" if m["in_formula"] else "N",
            f"{m['current_weight']:.3f}" if m['in_formula'] else "-",
            dir_str,
            emp_str,
            f"{m['spearman_r_overall']:.4f}",
            m["signal_strength"],
            match_str,
        ])
    print_table(headers, rows, [22, 10, 8, 6, 10, 12, 10, 8])

    # Highlight issues
    wrong = metric_data.get("wrong_direction_metrics", [])
    if wrong:
        print(f"\n  WRONG DIRECTION METRICS:")
        for m in wrong:
            print(f"    - {m['metric']}: formula={m['current_direction']:+d}, "
                  f"empirical={m['empirical_direction']:+d} "
                  f"(r={m['spearman_r_overall']:.4f})")

    zero = metric_data.get("zero_signal_metrics", [])
    if zero:
        print(f"\n  ZERO SIGNAL METRICS (in formula but no predictive power):")
        for m in zero:
            print(f"    - {m['metric']}: weight={m['current_weight']:.3f}, "
                  f"r={m['spearman_r_overall']:.4f}")

    missing = metric_data.get("missing_strong_signals", [])
    if missing:
        print(f"\n  MISSING STRONG SIGNALS (not in formula but significant):")
        for m in missing:
            print(f"    - {m['metric']}: r={m['spearman_r_overall']:.4f}, "
                  f"direction={m['empirical_direction']:+d}")


def print_direction_diagnosis(diag_data: Dict) -> None:
    """Print direction error diagnosis results."""
    hypotheses = diag_data.get("hypotheses", [])
    if not hypotheses:
        return

    print()
    for i, h in enumerate(hypotheses, 1):
        print(f"\n  Hypothesis {i}: {h['metric']} ({h['score_type']})")
        print(f"  {h['hypothesis'][:120]}...")

        if h.get("error"):
            print(f"  Result: {h['error']}")
            continue

        appr = h.get("appreciation_correlation")
        if appr:
            print(f"    vs Appreciation Excess: r={appr['spearman_r']:.4f} "
                  f"(p={appr['p_value']:.4f}, n={appr['n']}, "
                  f"implied dir={appr['implied_direction']:+d})")

        tr = h.get("total_return_correlation")
        if tr:
            print(f"    vs Total Return Excess: r={tr['spearman_r']:.4f} "
                  f"(p={tr['p_value']:.4f}, n={tr['n']}, "
                  f"implied dir={tr['implied_direction']:+d})")

        print(f"  CONCLUSION: {h['conclusion']}")


def print_normalization_impact(norm_data: Dict, score_type: str) -> None:
    """Print normalization impact analysis."""
    if norm_data.get("error"):
        print(f"\n  Normalization analysis not available: {norm_data['error']}")
        return

    print(f"\n  --- {score_type.upper()} Normalization Impact ---")
    print()
    headers = ["Scoring Method", "Spearman r vs Excess Return"]
    rows = [
        ["Raw Weighted Sum", f"{norm_data['correlation_raw_weighted_sum']:.4f}"],
        ["Min-Max Normalized", f"{norm_data['correlation_minmax_normalized']:.4f}"],
        ["Stored Score Value", f"{norm_data['correlation_stored_score']:.4f}"],
    ]
    print_table(headers, rows, [25, 30])

    print(f"\n  Signal loss from min-max: {norm_data['signal_loss_pct']:.1f}%")
    print(f"  Destroys signal: {'YES' if norm_data.get('destroys_signal') else 'No'}")
    print(f"  Summary: {norm_data['summary']}")


def print_full_console_report(report: Dict) -> None:
    """Print the complete console diagnostic report."""
    print_header("PROPERTYIQ DIAGNOSTIC ANALYSIS REPORT")
    print(f"  Generated: {report['generated_at']}")
    print(f"  Total rows: {report['total_rows']:,}")
    print(f"  Horizon: {report['horizon']}")
    print(f"  Score types: {', '.join(report['score_types_analyzed'])}")

    for st_result in report["results"]:
        score_type = st_result["score_type"]
        print_header(f"{score_type.upper()} DIAGNOSTIC RESULTS")
        print(f"  Target column: {st_result['target_column']}")
        print(f"  N with target: {st_result['n_with_target']:,}")

        # 2.2 IC
        print_ic_summary(st_result["ic_analysis"], score_type)

        # 2.3 Per-Metric
        print_per_metric_table(st_result["per_metric_analysis"], score_type)

        # 2.4 Quintile
        q_analysis = st_result["quintile_analysis"]
        if "error" not in q_analysis:
            print_quintile_table(q_analysis.get("excess_returns", {}), f"{score_type.upper()} Excess Return Quintiles")
            if q_analysis.get("raw_returns"):
                print_quintile_table(q_analysis["raw_returns"], f"{score_type.upper()} Raw Return Quintiles (comparison)")

            ta = q_analysis.get("target_assessment", {})
            print(f"\n  TARGET ASSESSMENT:")
            print(f"    Top quintile excess: {ta.get('top_quintile_actual', 0):.4f} "
                  f"(target > {ta.get('top_quintile_target', QUINTILE_TOP_TARGET)}) "
                  f"{'PASS' if ta.get('top_target_met') else 'FAIL'}")
            print(f"    Bottom quintile excess: {ta.get('bottom_quintile_actual', 0):.4f} "
                  f"(target < {ta.get('bottom_quintile_target', QUINTILE_BOTTOM_TARGET)}) "
                  f"{'PASS' if ta.get('bottom_target_met') else 'FAIL'}")

        # 2.5 Stability
        print_stability_table(st_result["time_stability"], score_type)
        breaks = st_result["time_stability"].get("regime_breaks", [])
        if breaks:
            print(f"\n  REGIME BREAKS DETECTED:")
            for b in breaks:
                print(f"    - {b['between']}: {b['type']} "
                      f"(IC: {b.get('prev_ic', 0):.4f} -> {b.get('curr_ic', 0):.4f})")

        # 2.7 Normalization
        print_normalization_impact(st_result["normalization_impact"], score_type)

    # 2.6 Direction diagnosis (cross-type)
    print_header("DIRECTION ERROR DIAGNOSIS")
    print_direction_diagnosis(report.get("direction_diagnosis", {}))

    # Final summary
    print_header("OVERALL DIAGNOSTIC SUMMARY")
    for st_result in report["results"]:
        score_type = st_result["score_type"]
        ic = st_result["ic_analysis"]
        q = st_result["quintile_analysis"]
        stab = st_result["time_stability"]

        ic_pass = ic.get("meets_mean_target", False) and ic.get("meets_ir_target", False)
        q_pass = q.get("target_assessment", {}).get("both_targets_met", False) if "error" not in q else False
        stab_pass = stab.get("all_years_pass", False)

        print(f"  {score_type.upper()}:")
        print(f"    IC targets met:        {'PASS' if ic_pass else 'FAIL'} "
              f"(mean={ic['mean_ic']:.4f}, IR={ic['ic_information_ratio']:.4f})")
        print(f"    Quintile targets met:  {'PASS' if q_pass else 'FAIL'}")
        print(f"    Time stability:        {'PASS' if stab_pass else 'FAIL'} "
              f"(failures: {', '.join(stab.get('failure_years', [])) or 'none'})")

        wrong_dir = st_result["per_metric_analysis"].get("wrong_direction_metrics", [])
        if wrong_dir:
            print(f"    Wrong directions:      {', '.join(m['metric'] for m in wrong_dir)}")
        zero_sig = st_result["per_metric_analysis"].get("zero_signal_metrics", [])
        if zero_sig:
            print(f"    Zero signal metrics:   {', '.join(m['metric'] for m in zero_sig)}")
        missing = st_result["per_metric_analysis"].get("missing_strong_signals", [])
        if missing:
            print(f"    Missing signals:       {', '.join(m['metric'] for m in missing)}")
        print()

    print_divider()


# ---------------------------------------------------------------------------
# JSON serialization helper
# ---------------------------------------------------------------------------

def _make_serializable(obj: Any) -> Any:
    """Recursively convert numpy/pandas types to native Python for JSON."""
    if isinstance(obj, dict):
        return {k: _make_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_make_serializable(v) for v in obj]
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (pd.Timestamp,)):
        return str(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    return obj


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="PropertyIQ diagnostic analysis: assess how well scoring "
                    "formulas predict excess returns.",
    )
    parser.add_argument(
        "--score-type",
        choices=["homeready", "investoredge", "both"],
        default="both",
        help="Which score type to analyze (default: both)",
    )
    parser.add_argument(
        "--geo-level",
        choices=["metro", "county", "zip", "all"],
        default="all",
        help="Geography level to analyze (default: all)",
    )
    parser.add_argument(
        "--horizon",
        choices=["1y", "3y"],
        default="3y",
        help="Outcome horizon to analyze (default: 3y)",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Output directory (default: scripts/analysis/output/)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Resolve paths
    script_dir = Path(__file__).resolve().parent
    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        output_dir = script_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Determine score types
    if args.score_type == "both":
        score_types = ["homeready", "investoredge"]
    else:
        score_types = [args.score_type]

    # Determine geo levels
    if args.geo_level == "all":
        geo_levels = ["metro", "county", "zip"]
    else:
        geo_levels = [args.geo_level]

    conn_string = _get_sqlalchemy_url()

    # Load z-scores once (shared across geo levels)
    logger.info("Loading z-scores for per-metric analysis ...")
    df_z_raw = load_z_scores(conn_string)
    df_z = expand_z_scores(df_z_raw) if not df_z_raw.empty else pd.DataFrame()

    # ------------------------------------------------------------------
    # Run diagnostics for each geo level
    # ------------------------------------------------------------------
    all_geo_reports = []
    for geo_level in geo_levels:
        logger.info("=" * 70)
        logger.info("GEO LEVEL: %s", geo_level.upper())
        logger.info("=" * 70)

        # Step 2.1: Extract data
        logger.info("[2.1] Extracting data for %s ...", geo_level)
        df_outcomes = load_backtest_outcomes(conn_string, geo_level=geo_level)
        if df_outcomes.empty:
            logger.warning("No backtest outcome data for %s. Skipping.", geo_level)
            continue

        logger.info(
            "Data extraction complete: %d outcome rows, %d z-score rows",
            len(df_outcomes), len(df_z),
        )

        score_results = []
        for score_type in score_types:
            logger.info("=" * 60)
            logger.info("Diagnosing: %s / %s (horizon=%s)", geo_level, score_type, args.horizon)
            logger.info("=" * 60)

            target = get_target_col(score_type, args.horizon)
            df_sub = df_outcomes[df_outcomes["score_type"] == score_type].copy()

            # Check if target column has data; fall back if needed
            n_with_target = df_sub[target].notna().sum()
            if n_with_target < 50:
                fallback = get_fallback_target_col(score_type, args.horizon)
                n_fallback = df_sub[fallback].notna().sum()
                if n_fallback > n_with_target:
                    logger.warning(
                        "Target %s has only %d rows; falling back to %s (%d rows)",
                        target, n_with_target, fallback, n_fallback,
                    )
                    target = fallback
                    n_with_target = n_fallback

            logger.info("Using target column: %s (%d rows with data)", target, n_with_target)

            # 2.2 IC Analysis
            ic_result = run_ic_analysis(df_outcomes, score_type, target)

            # 2.3 Per-Metric Analysis
            metric_result = run_per_metric_analysis(df_outcomes, df_z, score_type, target)

            # 2.4 Quintile Spread
            quintile_result = run_quintile_analysis(df_outcomes, score_type, target)

            # 2.5 Time Stability
            stability_result = run_time_stability(df_outcomes, score_type, target)

            # 2.7 Normalization Impact
            norm_result = run_normalization_impact(df_outcomes, df_z, score_type, target)

            score_results.append({
                "score_type": score_type,
                "target_column": target,
                "horizon": args.horizon,
                "n_total": len(df_sub),
                "n_with_target": int(n_with_target),
                "ic_analysis": ic_result,
                "per_metric_analysis": metric_result,
                "quintile_analysis": quintile_result,
                "time_stability": stability_result,
                "normalization_impact": norm_result,
            })

        # 2.6 Direction Diagnosis (runs across score types)
        direction_result = run_direction_diagnosis(df_outcomes, df_z, args.horizon)

        # Assemble report for this geo level
        report = {
            "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "geo_level": geo_level,
            "horizon": args.horizon,
            "total_rows": len(df_outcomes),
            "score_types_analyzed": score_types,
            "results": score_results,
            "direction_diagnosis": direction_result,
            "current_formula_weights": CURRENT_WEIGHTS,
            "targets": {
                "ic_mean": IC_TARGET_MEAN,
                "ic_ir": IC_IR_TARGET,
                "quintile_top": QUINTILE_TOP_TARGET,
                "quintile_bottom": QUINTILE_BOTTOM_TARGET,
            },
        }

        report = _make_serializable(report)

        # Save JSON report per geo level
        json_path = output_dir / f"diagnostic_report_{geo_level}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, default=str)
        logger.info("JSON report saved to %s", json_path)

        # Print console summary
        print_full_console_report(report)
        all_geo_reports.append(report)

    # Save combined report if multiple geo levels
    if len(all_geo_reports) > 1:
        combined = {
            "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "geo_levels": geo_levels,
            "reports": all_geo_reports,
        }
        combined_path = output_dir / "diagnostic_report_all.json"
        with open(combined_path, "w", encoding="utf-8") as f:
            json.dump(combined, f, indent=2, default=str)
        logger.info("Combined report saved to %s", combined_path)

    logger.info("Diagnostic analysis complete.")


if __name__ == "__main__":
    main()
