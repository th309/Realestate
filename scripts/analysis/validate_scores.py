"""
PropertyIQ Score Validation Script (Phase 5)

Comprehensive validation proving score accuracy across multiple dimensions:
  5.1 - In-sample metrics (correlation, quintile, decile, IC)
  5.2 - Out-of-sample metrics (from Phase 3 optimized weights)
  5.3 - Time stability (IC and quintile spread by year)
  5.4 - Calibration check (predicted vs actual percentile)
  5.5 - Both score types (HomeReady and InvestorEdge)

Outputs:
  - Markdown validation report
  - JSON data for dashboard consumption
  - Console summary

Usage:
  python validate_scores.py
  python validate_scores.py --score-type homeready
  python validate_scores.py --score-type investoredge --output-dir ./custom_output
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd
from scipy import stats

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
# Database helpers
# ---------------------------------------------------------------------------

def _get_connection_string() -> str:
    """Build a PostgreSQL connection string from environment variables.

    Tries in order:
      1. DATABASE_URL environment variable (direct connection string)
      2. Supabase pooler connection (preferred for serverless / long-running scripts)
    """
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url

    # Use Supabase connection pooler (PgBouncer)
    project_ref = "pysflbhpnqwoczyuaaif"
    host = "aws-1-us-east-1.pooler.supabase.com"
    port = 6543
    user = f"postgres.{project_ref}"
    password = os.environ.get("SUPABASE_DB_PASSWORD", "IHatedoingpt12")
    return (
        f"postgresql://{user}:{password}"
        f"@{host}:{port}/postgres?sslmode=require"
    )


def load_backtest_data(conn_string: str, geo_level: str = "metro") -> pd.DataFrame:
    """Load backtest outcomes with division mapping.

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
        bo.outcome_1y_value::float   AS outcome_1y,
        bo.outcome_3y_value::float   AS outcome_3y,
        bo.excess_vs_state_1y::float,
        bo.excess_vs_state_3y::float,
        bo.rent_return_1y::float     AS rent_return_1y,
        bo.rent_return_3y_cagr::float AS rent_return_3y_cagr,
        cdm.division_id,
        cdm.division_name
    FROM propertyiq_backtest_outcomes bo
    LEFT JOIN census_division_mapping cdm
        ON bo.state_code = cdm.state_code
    WHERE bo.score_value IS NOT NULL
      {geo_filter}
    ORDER BY bo.score_type, bo.score_date, bo.geography_id
    """

    df = pd.read_sql(query, engine)
    engine.dispose()

    # Parse score_date into datetime
    df["score_date"] = pd.to_datetime(df["score_date"])
    df["year"] = df["score_date"].dt.year

    logger.info(
        "Loaded %d rows (%d homeready, %d investoredge)",
        len(df),
        (df["score_type"] == "homeready").sum(),
        (df["score_type"] == "investoredge").sum(),
    )
    return df


# ---------------------------------------------------------------------------
# Excess return computation
# ---------------------------------------------------------------------------

def compute_excess_returns(df: pd.DataFrame) -> pd.DataFrame:
    """
    For each row compute excess return vs the Census-division median for the
    same score_date.  Falls back to national median when division is unknown.

    Adds columns:
      - excess_div_1y, excess_div_3y          (appreciation excess vs division)
      - excess_nat_1y, excess_nat_3y          (appreciation excess vs national)
      - total_return_3y                       (outcome_3y + rent CAGR)
      - excess_total_div_3y                   (total return excess vs division)
    """
    df = df.copy()

    # --- Appreciation excess vs division median ---
    for horizon_col, new_col in [
        ("outcome_1y", "excess_div_1y"),
        ("outcome_3y", "excess_div_3y"),
    ]:
        group_key = ["score_type", "score_date", "division_id"]
        medians = (
            df.dropna(subset=[horizon_col, "division_id"])
            .groupby(group_key)[horizon_col]
            .transform("median")
        )
        df[new_col] = np.nan
        mask = df[horizon_col].notna() & df["division_id"].notna()
        df.loc[mask, new_col] = df.loc[mask, horizon_col] - medians.reindex(df.index)

    # --- Appreciation excess vs national median ---
    for horizon_col, new_col in [
        ("outcome_1y", "excess_nat_1y"),
        ("outcome_3y", "excess_nat_3y"),
    ]:
        group_key = ["score_type", "score_date"]
        medians = (
            df.dropna(subset=[horizon_col])
            .groupby(group_key)[horizon_col]
            .transform("median")
        )
        df[new_col] = np.nan
        mask = df[horizon_col].notna()
        df.loc[mask, new_col] = df.loc[mask, horizon_col] - medians.reindex(df.index)

    # --- Total return (appreciation + rent) for InvestorEdge ---
    df["total_return_3y"] = np.where(
        df["outcome_3y"].notna() & df["rent_return_3y_cagr"].notna(),
        df["outcome_3y"] + df["rent_return_3y_cagr"],
        np.nan,
    )

    # --- Total return excess vs division ---
    tr_col = "total_return_3y"
    group_key = ["score_type", "score_date", "division_id"]
    tr_medians = (
        df.dropna(subset=[tr_col, "division_id"])
        .groupby(group_key)[tr_col]
        .transform("median")
    )
    df["excess_total_div_3y"] = np.nan
    mask = df[tr_col].notna() & df["division_id"].notna()
    df.loc[mask, "excess_total_div_3y"] = (
        df.loc[mask, tr_col] - tr_medians.reindex(df.index)
    )

    return df


# ---------------------------------------------------------------------------
# Target column selection
# ---------------------------------------------------------------------------

def target_col_for_score(score_type: str) -> str:
    """
    Return the primary excess-return column for a given score type.

    HomeReady  -> 3Y appreciation CAGR excess vs division median
    InvestorEdge -> 3Y total return CAGR excess vs division median
    """
    if score_type == "homeready":
        return "excess_div_3y"
    elif score_type == "investoredge":
        return "excess_total_div_3y"
    else:
        raise ValueError(f"Unknown score type: {score_type}")


# ---------------------------------------------------------------------------
# 5.1  In-sample metrics
# ---------------------------------------------------------------------------

def _pearson_spearman(scores: np.ndarray, excess: np.ndarray):
    """Return (pearson_r, spearman_r) handling edge cases."""
    try:
        pr, _ = stats.pearsonr(scores, excess)
        pr = float(pr) if np.isfinite(pr) else 0.0
    except Exception:
        pr = 0.0
    try:
        sr, _ = stats.spearmanr(scores, excess)
        sr = float(sr) if np.isfinite(sr) else 0.0
    except Exception:
        sr = 0.0
    return pr, sr


def compute_quintile_table(
    scores: np.ndarray,
    excess: np.ndarray,
) -> list[dict]:
    """
    Quintile table: avg score, avg excess return, count, beat-median rate.
    Quintile 1 = lowest scores, Quintile 5 = highest scores.
    """
    try:
        labels = pd.qcut(scores, 5, labels=False, duplicates="drop") + 1
    except ValueError:
        # Too few unique values for 5 quantiles; fall back to rank-based
        labels = pd.Series(scores).rank(method="first", pct=True)
        labels = np.ceil(labels * 5).astype(int).clip(1, 5).values

    rows = []
    for q in sorted(set(labels)):
        mask = labels == q
        q_scores = scores[mask]
        q_excess = excess[mask]
        rows.append(
            {
                "quintile": int(q),
                "avg_score": round(float(np.mean(q_scores)), 2),
                "avg_excess_return": round(float(np.mean(q_excess)), 4),
                "count": int(mask.sum()),
                "beat_median_rate": round(
                    float((q_excess > 0).sum() / len(q_excess) * 100), 1
                ),
            }
        )
    return rows


def compute_decile_spread(scores: np.ndarray, excess: np.ndarray) -> dict:
    """Difference between top decile and bottom decile avg excess return."""
    try:
        labels = pd.qcut(scores, 10, labels=False, duplicates="drop")
    except ValueError:
        labels = pd.Series(scores).rank(method="first", pct=True)
        labels = np.ceil(labels * 10).astype(int).clip(1, 10).values - 1

    top_mask = labels == labels.max()
    bot_mask = labels == labels.min()
    top_avg = float(np.mean(excess[top_mask])) if top_mask.any() else 0.0
    bot_avg = float(np.mean(excess[bot_mask])) if bot_mask.any() else 0.0
    return {
        "top_decile_avg_excess": round(top_avg, 4),
        "bottom_decile_avg_excess": round(bot_avg, 4),
        "decile_spread": round(top_avg - bot_avg, 4),
    }


def compute_ic_statistics(
    df_sub: pd.DataFrame,
    target: str,
) -> dict:
    """
    Information Coefficient (IC) = cross-sectional rank correlation per period.
    Returns mean IC, std IC, IR (mean/std), hit rate (% of periods with IC > 0).
    """
    ics = []
    for _, grp in df_sub.groupby("score_date"):
        s = grp["score_value"].values
        e = grp[target].values
        if len(s) < 10:
            continue
        try:
            sr, _ = stats.spearmanr(s, e)
            if np.isfinite(sr):
                ics.append(float(sr))
        except Exception:
            pass

    if not ics:
        return {"mean_ic": 0.0, "std_ic": 0.0, "ir": 0.0, "hit_rate": 0.0, "n_periods": 0}

    arr = np.array(ics)
    mean_ic = float(np.mean(arr))
    std_ic = float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0
    ir = mean_ic / std_ic if std_ic > 0 else 0.0
    hit_rate = float((arr > 0).sum() / len(arr) * 100)
    return {
        "mean_ic": round(mean_ic, 4),
        "std_ic": round(std_ic, 4),
        "ir": round(ir, 4),
        "hit_rate": round(hit_rate, 1),
        "n_periods": len(ics),
    }


def run_insample_metrics(
    df_sub: pd.DataFrame,
    target: str,
) -> dict:
    """Step 5.1: full in-sample metrics block."""
    valid = df_sub.dropna(subset=["score_value", target])
    scores = valid["score_value"].values
    excess = valid[target].values

    if len(scores) < 20:
        logger.warning("Insufficient data for in-sample metrics (n=%d)", len(scores))
        return {"error": "insufficient_data", "n": len(scores)}

    pr, sr = _pearson_spearman(scores, excess)
    quintiles = compute_quintile_table(scores, excess)
    decile = compute_decile_spread(scores, excess)
    ic_stats = compute_ic_statistics(valid, target)

    return {
        "n": int(len(scores)),
        "pearson_r": round(pr, 4),
        "spearman_r": round(sr, 4),
        "quintile_table": quintiles,
        "decile_spread": decile,
        "ic_statistics": ic_stats,
    }


# ---------------------------------------------------------------------------
# 5.2  Out-of-sample metrics
# ---------------------------------------------------------------------------

def run_oos_metrics(
    oos_path: Optional[str],
    insample_results: dict,
) -> dict:
    """
    Step 5.2: Load optimized_weights.json (Phase 3 output) and summarise
    out-of-sample validation metrics.
    """
    if oos_path is None or not os.path.exists(oos_path):
        return {"error": "oos_results_not_found", "path": oos_path}

    with open(oos_path, "r") as f:
        oos_data = json.load(f)

    # The Phase 3 output may contain per-fold results with keys like:
    #   fold_results[].oos_ic, fold_results[].oos_quintile_spread,
    #   fold_results[].oos_hit_rate
    # We also support a flat structure with oos_* keys directly.

    fold_results = oos_data.get("fold_results", [])
    if not fold_results and "cv_folds" in oos_data:
        fold_results = oos_data["cv_folds"]

    if fold_results:
        oos_ics = [f.get("oos_ic", f.get("ic", 0)) for f in fold_results if f.get("oos_ic", f.get("ic")) is not None]
        oos_spreads = [f.get("oos_quintile_spread", f.get("quintile_spread", 0)) for f in fold_results if f.get("oos_quintile_spread", f.get("quintile_spread")) is not None]
        oos_hit_rates = [f.get("oos_hit_rate", f.get("hit_rate", 0)) for f in fold_results if f.get("oos_hit_rate", f.get("hit_rate")) is not None]
    else:
        # Flat structure fallback
        oos_ics = [oos_data.get("oos_ic", 0)]
        oos_spreads = [oos_data.get("oos_quintile_spread", 0)]
        oos_hit_rates = [oos_data.get("oos_hit_rate", 0)]

    avg_oos_ic = float(np.mean(oos_ics)) if oos_ics else 0.0
    avg_oos_spread = float(np.mean(oos_spreads)) if oos_spreads else 0.0
    avg_oos_hit = float(np.mean(oos_hit_rates)) if oos_hit_rates else 0.0

    # Compute IC_IR for OOS
    if len(oos_ics) > 1:
        oos_ic_std = float(np.std(oos_ics, ddof=1))
        oos_ic_ir = avg_oos_ic / oos_ic_std if oos_ic_std > 0 else 0.0
    else:
        oos_ic_ir = 0.0

    # Degradation vs in-sample
    is_ic = insample_results.get("ic_statistics", {}).get("mean_ic", 0)
    is_spread = insample_results.get("decile_spread", {}).get("decile_spread", 0)

    degradation_ic = (
        round(1 - avg_oos_ic / is_ic, 4) if is_ic != 0 else None
    )
    degradation_spread = (
        round(1 - avg_oos_spread / is_spread, 4) if is_spread != 0 else None
    )

    return {
        "avg_oos_quintile_spread": round(avg_oos_spread, 4),
        "avg_oos_ic": round(avg_oos_ic, 4),
        "oos_ic_ir": round(oos_ic_ir, 4),
        "avg_oos_hit_rate": round(avg_oos_hit, 1),
        "degradation_ic": degradation_ic,
        "degradation_spread": degradation_spread,
        "n_folds": len(fold_results) if fold_results else 1,
        "source_file": oos_path,
    }


# ---------------------------------------------------------------------------
# 5.3  Time stability
# ---------------------------------------------------------------------------

def run_time_stability(
    df_sub: pd.DataFrame,
    target: str,
    years: Optional[list[int]] = None,
) -> dict:
    """Step 5.3: IC and quintile spread by year, plus failure detection."""
    if years is None:
        years = sorted(df_sub["year"].dropna().unique().astype(int).tolist())

    results_by_year: list[dict] = []
    failures: list[str] = []

    for yr in years:
        yr_df = df_sub[df_sub["year"] == yr].dropna(subset=["score_value", target])
        n = len(yr_df)
        if n < 20:
            results_by_year.append({"year": yr, "n": n, "skipped": True})
            continue

        scores = yr_df["score_value"].values
        excess = yr_df[target].values

        # IC for the year (using each period within the year)
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

        # Quintile spread for the year
        decile = compute_decile_spread(scores, excess)
        quintiles = compute_quintile_table(scores, excess)

        qspread = 0.0
        if len(quintiles) >= 2:
            qspread = quintiles[-1]["avg_excess_return"] - quintiles[0]["avg_excess_return"]

        # Failure detection: IC negative OR quintile spread negative
        failed = mean_ic < 0 or qspread < 0
        if failed:
            failures.append(str(yr))

        results_by_year.append(
            {
                "year": yr,
                "n": n,
                "mean_ic": round(mean_ic, 4),
                "n_periods": len(ic_vals),
                "quintile_spread": round(qspread, 4),
                "decile_spread": decile["decile_spread"],
                "failed": failed,
            }
        )

    return {
        "by_year": results_by_year,
        "failure_years": failures,
        "all_years_pass": len(failures) == 0,
    }


# ---------------------------------------------------------------------------
# 5.4  Calibration check
# ---------------------------------------------------------------------------

def run_calibration_check(
    df_sub: pd.DataFrame,
    target: str,
) -> dict:
    """
    Step 5.4: For each score decile, compare predicted percentile
    (midpoint of decile) to actual percentile of excess returns.
    Perfect calibration = diagonal.  Return MAD from diagonal.
    """
    valid = df_sub.dropna(subset=["score_value", target])
    if len(valid) < 50:
        return {"error": "insufficient_data", "n": len(valid)}

    scores = valid["score_value"].values
    excess = valid[target].values

    # Assign score deciles (1-10)
    try:
        decile_labels = pd.qcut(scores, 10, labels=False, duplicates="drop") + 1
    except ValueError:
        decile_labels = (
            pd.Series(scores)
            .rank(method="first", pct=True)
            .pipe(lambda x: np.ceil(x * 10).astype(int).clip(1, 10))
            .values
        )

    # For each decile compute actual percentile rank of its median excess
    # return among all excess returns.
    overall_sorted = np.sort(excess)
    n_total = len(overall_sorted)

    decile_rows = []
    for d in sorted(set(decile_labels)):
        mask = decile_labels == d
        d_excess = excess[mask]
        median_excess = float(np.median(d_excess))
        # Actual percentile: fraction of overall values <= median_excess
        actual_pctile = float(np.searchsorted(overall_sorted, median_excess, side="right") / n_total * 100)
        predicted_pctile = (d - 0.5) / max(decile_labels) * 100  # midpoint
        decile_rows.append(
            {
                "decile": int(d),
                "predicted_percentile": round(predicted_pctile, 1),
                "actual_percentile": round(actual_pctile, 1),
                "deviation": round(abs(actual_pctile - predicted_pctile), 2),
                "n": int(mask.sum()),
            }
        )

    deviations = [r["deviation"] for r in decile_rows]
    mad = float(np.mean(deviations)) if deviations else 0.0

    return {
        "decile_calibration": decile_rows,
        "mean_absolute_deviation": round(mad, 2),
        "well_calibrated": mad < 15.0,  # Threshold: < 15pp average deviation
    }


# ---------------------------------------------------------------------------
# 5.5  Run for one score type
# ---------------------------------------------------------------------------

def validate_score_type(
    df: pd.DataFrame,
    score_type: str,
    oos_path: Optional[str],
) -> dict:
    """Run all validation steps for a single score type."""
    target = target_col_for_score(score_type)
    df_sub = df[df["score_type"] == score_type].copy()

    if df_sub.empty:
        return {"error": f"No data for score_type={score_type}"}

    logger.info(
        "Validating %s  (n=%d, target=%s)", score_type, len(df_sub), target
    )

    insample = run_insample_metrics(df_sub, target)
    oos = run_oos_metrics(oos_path, insample)
    stability = run_time_stability(df_sub, target)
    calibration = run_calibration_check(df_sub, target)

    return {
        "score_type": score_type,
        "target_column": target,
        "n_total": len(df_sub),
        "n_with_target": int(df_sub[target].notna().sum()),
        "insample": insample,
        "oos": oos,
        "time_stability": stability,
        "calibration": calibration,
    }


# ---------------------------------------------------------------------------
# Report generation  (Markdown)
# ---------------------------------------------------------------------------

def _fmt(v, decimals=4) -> str:
    """Format numeric value for display."""
    if v is None:
        return "N/A"
    if isinstance(v, float):
        return f"{v:.{decimals}f}"
    return str(v)


def _pct(v, decimals=1) -> str:
    if v is None:
        return "N/A"
    return f"{v:.{decimals}f}%"


def generate_markdown_report(results: dict, output_path: str) -> None:
    """Write the full markdown validation report."""
    lines: list[str] = []

    def w(text: str = ""):
        lines.append(text)

    w("# PropertyIQ Score Validation Report")
    w()
    w(f"**Generated:** {results['generated_at']}")
    w(f"**Data rows:** {results['total_rows']:,}")
    w()

    for st_result in results["score_types"]:
        stype = st_result["score_type"]
        w(f"---")
        w(f"## {stype.upper()} Score Validation")
        w()
        w(f"- **Target:** {st_result['target_column']}")
        w(f"- **Total observations:** {st_result['n_total']:,}")
        w(f"- **With target outcome:** {st_result['n_with_target']:,}")
        w()

        # ---- 5.1 In-Sample ----
        ins = st_result.get("insample", {})
        if "error" in ins:
            w(f"### 5.1 In-Sample Metrics")
            w(f"> Skipped: {ins['error']} (n={ins.get('n', 0)})")
            w()
        else:
            w(f"### 5.1 In-Sample Metrics")
            w()
            w(f"| Metric | Value |")
            w(f"|--------|-------|")
            w(f"| Sample size | {ins['n']:,} |")
            w(f"| Pearson r | {_fmt(ins['pearson_r'])} |")
            w(f"| Spearman r | {_fmt(ins['spearman_r'])} |")
            w()

            # Quintile table
            w(f"#### Quintile Analysis")
            w()
            w(f"| Quintile | Avg Score | Avg Excess Return | Count | Beat-Median Rate |")
            w(f"|:--------:|----------:|------------------:|------:|-----------------:|")
            for q in ins.get("quintile_table", []):
                w(
                    f"| Q{q['quintile']} | {q['avg_score']:.1f} "
                    f"| {q['avg_excess_return']:.4f} "
                    f"| {q['count']:,} "
                    f"| {_pct(q['beat_median_rate'])} |"
                )
            w()

            # Decile spread
            ds = ins.get("decile_spread", {})
            w(f"#### Decile Spread")
            w()
            w(f"| Metric | Value |")
            w(f"|--------|------:|")
            w(f"| Top decile avg excess | {_fmt(ds.get('top_decile_avg_excess'))} |")
            w(f"| Bottom decile avg excess | {_fmt(ds.get('bottom_decile_avg_excess'))} |")
            w(f"| **Decile spread** | **{_fmt(ds.get('decile_spread'))}** |")
            w()

            # IC statistics
            ic = ins.get("ic_statistics", {})
            w(f"#### Information Coefficient (IC)")
            w()
            w(f"| Metric | Value |")
            w(f"|--------|------:|")
            w(f"| Mean IC | {_fmt(ic.get('mean_ic'))} |")
            w(f"| Std IC | {_fmt(ic.get('std_ic'))} |")
            w(f"| IR (IC/std) | {_fmt(ic.get('ir'))} |")
            w(f"| Hit rate | {_pct(ic.get('hit_rate'))} |")
            w(f"| Periods | {ic.get('n_periods', 0)} |")
            w()

        # ---- 5.2 OOS ----
        oos = st_result.get("oos", {})
        w(f"### 5.2 Out-of-Sample Metrics")
        w()
        if "error" in oos:
            w(f"> OOS results not available: {oos['error']}")
            if oos.get("path"):
                w(f"> Expected path: `{oos['path']}`")
            w()
        else:
            w(f"| Metric | Value |")
            w(f"|--------|------:|")
            w(f"| Avg OOS quintile spread | {_fmt(oos.get('avg_oos_quintile_spread'))} |")
            w(f"| Avg OOS IC | {_fmt(oos.get('avg_oos_ic'))} |")
            w(f"| OOS IC IR | {_fmt(oos.get('oos_ic_ir'))} |")
            w(f"| Avg OOS hit rate | {_pct(oos.get('avg_oos_hit_rate'))} |")
            w(f"| IC degradation (IS -> OOS) | {_fmt(oos.get('degradation_ic'))} |")
            w(f"| Spread degradation | {_fmt(oos.get('degradation_spread'))} |")
            w(f"| # folds | {oos.get('n_folds', 'N/A')} |")
            w()

        # ---- 5.3 Time Stability ----
        stab = st_result.get("time_stability", {})
        w(f"### 5.3 Time Stability")
        w()
        by_year = stab.get("by_year", [])
        if by_year:
            w(f"| Year | N | Mean IC | Quintile Spread | Decile Spread | Status |")
            w(f"|:----:|----:|--------:|----------------:|--------------:|:------:|")
            for yr_row in by_year:
                if yr_row.get("skipped"):
                    w(f"| {yr_row['year']} | {yr_row['n']} | - | - | - | skipped |")
                else:
                    status = "FAIL" if yr_row.get("failed") else "PASS"
                    w(
                        f"| {yr_row['year']} | {yr_row['n']:,} "
                        f"| {_fmt(yr_row.get('mean_ic'))} "
                        f"| {_fmt(yr_row.get('quintile_spread'))} "
                        f"| {_fmt(yr_row.get('decile_spread'))} "
                        f"| {status} |"
                    )
            w()
            failures = stab.get("failure_years", [])
            if failures:
                w(f"> **Warning:** Model fails in year(s): {', '.join(failures)}")
            else:
                w(f"> All years pass stability checks.")
            w()
        else:
            w("> No yearly data available.")
            w()

        # ---- 5.4 Calibration ----
        cal = st_result.get("calibration", {})
        w(f"### 5.4 Calibration Check")
        w()
        if "error" in cal:
            w(f"> Skipped: {cal['error']}")
            w()
        else:
            w(f"| Decile | Predicted Pctile | Actual Pctile | Deviation | N |")
            w(f"|:------:|-----------------:|--------------:|----------:|----:|")
            for row in cal.get("decile_calibration", []):
                w(
                    f"| {row['decile']} "
                    f"| {row['predicted_percentile']:.1f} "
                    f"| {row['actual_percentile']:.1f} "
                    f"| {row['deviation']:.1f} "
                    f"| {row['n']:,} |"
                )
            w()
            mad = cal.get("mean_absolute_deviation", 0)
            ok = cal.get("well_calibrated", False)
            w(f"**Mean Absolute Deviation from diagonal:** {mad:.2f} pp")
            w(f"**Well-calibrated (< 15 pp):** {'Yes' if ok else 'No'}")
            w()

    # ---- Overall Summary ----
    w("---")
    w("## Overall Summary")
    w()
    w("| Score Type | Pearson r | Spearman r | Decile Spread | Mean IC | IC IR | Hit Rate | Calibration MAD |")
    w("|------------|----------:|-----------:|--------------:|--------:|------:|---------:|----------------:|")
    for st_result in results["score_types"]:
        stype = st_result["score_type"]
        ins = st_result.get("insample", {})
        cal = st_result.get("calibration", {})
        ic = ins.get("ic_statistics", {})
        ds = ins.get("decile_spread", {})
        w(
            f"| {stype} "
            f"| {_fmt(ins.get('pearson_r'))} "
            f"| {_fmt(ins.get('spearman_r'))} "
            f"| {_fmt(ds.get('decile_spread'))} "
            f"| {_fmt(ic.get('mean_ic'))} "
            f"| {_fmt(ic.get('ir'))} "
            f"| {_pct(ic.get('hit_rate'))} "
            f"| {_fmt(cal.get('mean_absolute_deviation'), 2)} |"
        )
    w()

    report_text = "\n".join(lines)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report_text)
    logger.info("Markdown report written to %s", output_path)


# ---------------------------------------------------------------------------
# Console summary
# ---------------------------------------------------------------------------

def print_console_summary(results: dict) -> None:
    """Print a concise summary to stdout."""
    sep = "=" * 72
    print(f"\n{sep}")
    print("  PROPERTYIQ SCORE VALIDATION SUMMARY")
    print(f"{sep}")
    print(f"  Generated: {results['generated_at']}")
    print(f"  Total rows: {results['total_rows']:,}")
    print()

    for st_result in results["score_types"]:
        stype = st_result["score_type"].upper()
        ins = st_result.get("insample", {})
        ic = ins.get("ic_statistics", {})
        ds = ins.get("decile_spread", {})
        cal = st_result.get("calibration", {})
        stab = st_result.get("time_stability", {})
        oos = st_result.get("oos", {})

        print(f"  --- {stype} ---")
        if "error" not in ins:
            print(f"    In-sample N:         {ins.get('n', 0):,}")
            print(f"    Pearson r:           {_fmt(ins.get('pearson_r'))}")
            print(f"    Spearman r:          {_fmt(ins.get('spearman_r'))}")
            print(f"    Decile spread:       {_fmt(ds.get('decile_spread'))}")
            print(f"    Mean IC:             {_fmt(ic.get('mean_ic'))}")
            print(f"    IC IR:               {_fmt(ic.get('ir'))}")
            print(f"    IC Hit rate:         {_pct(ic.get('hit_rate'))}")
        else:
            print(f"    In-sample: {ins.get('error')}")

        if "error" not in oos:
            print(f"    OOS IC:              {_fmt(oos.get('avg_oos_ic'))}")
            print(f"    OOS Spread:          {_fmt(oos.get('avg_oos_quintile_spread'))}")
            print(f"    OOS Hit rate:        {_pct(oos.get('avg_oos_hit_rate'))}")
            deg_ic = oos.get("degradation_ic")
            if deg_ic is not None:
                print(f"    IC degradation:      {_fmt(deg_ic)}")
        else:
            print(f"    OOS: {oos.get('error', 'not available')}")

        fails = stab.get("failure_years", [])
        if fails:
            print(f"    Time stability:      FAIL in {', '.join(fails)}")
        elif stab.get("all_years_pass"):
            print(f"    Time stability:      All years PASS")

        if "error" not in cal:
            print(f"    Calibration MAD:     {cal.get('mean_absolute_deviation', 0):.2f} pp")
            print(f"    Well-calibrated:     {'Yes' if cal.get('well_calibrated') else 'No'}")
        print()

    print(sep)
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="PropertyIQ score validation (Phase 5)",
    )
    parser.add_argument(
        "--score-type",
        choices=["homeready", "investoredge", "both"],
        default="both",
        help="Which score type to validate (default: both)",
    )
    parser.add_argument(
        "--geo-level",
        choices=["metro", "county", "zip", "all"],
        default="all",
        help="Geography level to validate (default: all)",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Output directory (default: scripts/analysis/output/)",
    )
    parser.add_argument(
        "--oos-results",
        default=None,
        help="Path to optimized_weights.json (Phase 3 OOS output)",
    )
    args = parser.parse_args()

    # Resolve paths
    script_dir = Path(__file__).resolve().parent
    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        output_dir = script_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    oos_path = args.oos_results
    if oos_path is None:
        # Default location
        default_oos = script_dir / "output" / "optimized_weights.json"
        if default_oos.exists():
            oos_path = str(default_oos)
            logger.info("Found OOS results at default path: %s", oos_path)
        else:
            logger.warning(
                "No OOS results file found at %s. OOS metrics will be skipped.",
                default_oos,
            )

    # Connect to database
    logger.info("Connecting to database...")
    conn_string = _get_connection_string()

    # Determine which score types and geo levels to run
    if args.score_type == "both":
        score_types = ["homeready", "investoredge"]
    else:
        score_types = [args.score_type]

    if args.geo_level == "all":
        geo_levels = ["metro", "county", "zip"]
    else:
        geo_levels = [args.geo_level]

    all_geo_results = []
    for geo_level in geo_levels:
        logger.info("=" * 70)
        logger.info("GEO LEVEL: %s", geo_level.upper())
        logger.info("=" * 70)

        # Load data for this geo level
        logger.info("Loading backtest outcomes data for %s...", geo_level)
        df_raw = load_backtest_data(conn_string, geo_level=geo_level)
        if df_raw.empty:
            logger.warning("No data for %s. Skipping.", geo_level)
            continue

        # Compute excess returns (division-relative benchmarks)
        logger.info("Computing excess returns vs division medians...")
        df = compute_excess_returns(df_raw)

        # Run validation for each score type
        score_results: list[dict] = []
        for stype in score_types:
            logger.info("=" * 60)
            logger.info("Running validation for: %s / %s", geo_level, stype)
            logger.info("=" * 60)
            # Look for geo-level-specific OOS results
            geo_oos_path = oos_path
            if oos_path and geo_level != "metro":
                geo_specific = str(Path(oos_path).parent / f"optimized_weights_{geo_level}.json")
                if Path(geo_specific).exists():
                    geo_oos_path = geo_specific
            result = validate_score_type(df, stype, geo_oos_path)
            score_results.append(result)

        # Assemble results for this geo level
        results = {
            "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "geo_level": geo_level,
            "total_rows": len(df_raw),
            "score_types": score_results,
        }

        # Write JSON output per geo level
        json_path = output_dir / f"validation_data_{geo_level}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, default=str)
        logger.info("JSON data written to %s", json_path)

        # Write Markdown report per geo level
        md_path = output_dir / f"validation_report_{geo_level}.md"
        generate_markdown_report(results, str(md_path))

        # Print console summary
        print_console_summary(results)
        all_geo_results.append(results)

    # Save combined results if multiple geo levels
    if len(all_geo_results) > 1:
        combined = {
            "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "geo_levels": geo_levels,
            "results": all_geo_results,
        }
        combined_path = output_dir / "validation_data_all.json"
        with open(combined_path, "w", encoding="utf-8") as f:
            json.dump(combined, f, indent=2, default=str)
        logger.info("Combined validation data saved to %s", combined_path)

    logger.info("Validation complete.")


if __name__ == "__main__":
    main()
