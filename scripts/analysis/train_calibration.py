#!/usr/bin/env python3
"""
PropertyIQ Isotonic Calibration Training Script

Trains isotonic regression models that map raw score percentile to calibrated
outcome percentile, then exports JSON lookup tables for the TypeScript backend.

For each (score_type, geo_level) combination:
  - HomeReady target: excess_div_3y (3Y appreciation CAGR excess vs division)
  - InvestorEdge target: excess_total_div_3y (3Y total return excess vs division),
    falling back to excess_div_3y if sparse

The isotonic model learns: predicted_score_percentile -> actual_excess_return_percentile
so that a calibrated score of 70 means "70% of markets with this score had excess
returns below this level."

Outputs:
  - scripts/analysis/output/calibration_tables.json
  - packages/backend/src/scoring/calibration/calibration-tables.json

Usage:
  python train_calibration.py
  python train_calibration.py --geo-level metro
  python train_calibration.py --output-dir ./custom_output
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

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

SCORE_TYPES = ["homeready", "investoredge"]
GEO_LEVELS = ["metro", "county"]

# Percentile grid for the lookup table (0, 5, 10, ..., 100)
LOOKUP_GRID = list(range(0, 101, 5))

# Minimum number of rows required to train a model
MIN_SAMPLES_FOR_TRAINING = 50

# Minimum coverage of the target column before falling back
MIN_TARGET_COVERAGE_FRACTION = 0.05

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def _get_connection_string() -> str:
    """Build a PostgreSQL connection string from environment variables.

    Tries in order:
      1. DATABASE_URL environment variable (direct connection string)
      2. Supabase pooler connection (preferred for long-running scripts)
    """
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url

    project_ref = "pysflbhpnqwoczyuaaif"
    host = "aws-1-us-east-1.pooler.supabase.com"
    port = 6543
    user = f"postgres.{project_ref}"
    password = os.environ.get("SUPABASE_DB_PASSWORD", "")
    if not password:
        logger.error("SUPABASE_DB_PASSWORD not set")
        sys.exit(1)
    return (
        f"postgresql://{user}:{password}"
        f"@{host}:{port}/postgres?sslmode=require"
        f"&options=-c%20statement_timeout%3D300000"
    )


def load_backtest_data(conn_string: str, geo_level: str = "metro") -> pd.DataFrame:
    """Load backtest outcomes with census division mapping.

    Args:
        conn_string: SQLAlchemy connection string.
        geo_level: 'metro' or 'county'.

    Returns:
        DataFrame with score values, outcomes, and division info.
    """
    import sqlalchemy

    engine = sqlalchemy.create_engine(conn_string)

    from sqlalchemy import text as sa_text

    query = sa_text("""
    SELECT
        bo.geography_id,
        bo.geography_type,
        bo.score_type,
        bo.score_date,
        bo.score_value::float,
        bo.state_code,
        bo.outcome_3y_value::float   AS outcome_3y,
        bo.excess_vs_state_3y::float,
        bo.rent_return_3y_cagr::float AS rent_return_3y_cagr,
        cdm.division_id,
        cdm.division_name
    FROM propertyiq_backtest_outcomes bo
    LEFT JOIN census_division_mapping cdm
        ON bo.state_code = cdm.state_code
    WHERE bo.score_value IS NOT NULL
      AND (:geo_level = 'all' OR bo.geography_type = :geo_level)
    ORDER BY bo.score_type, bo.score_date, bo.geography_id
    """)

    df = pd.read_sql(query, engine, params={"geo_level": geo_level})
    engine.dispose()

    df["score_date"] = pd.to_datetime(df["score_date"])

    logger.info(
        "Loaded %d rows for %s (%d homeready, %d investoredge)",
        len(df),
        geo_level,
        (df["score_type"] == "homeready").sum(),
        (df["score_type"] == "investoredge").sum(),
    )
    return df


# ---------------------------------------------------------------------------
# Excess return computation (mirrors validate_scores.py)
# ---------------------------------------------------------------------------


def compute_excess_returns(df: pd.DataFrame) -> pd.DataFrame:
    """Compute excess returns vs Census-division median for the same score_date.

    Adds columns:
      - excess_div_3y          (appreciation excess vs division)
      - total_return_3y        (outcome_3y + rent CAGR)
      - excess_total_div_3y    (total return excess vs division)
    """
    df = df.copy()

    # --- Appreciation excess vs division median ---
    horizon_col = "outcome_3y"
    new_col = "excess_div_3y"
    group_key = ["score_type", "score_date", "division_id"]
    medians = (
        df.dropna(subset=[horizon_col, "division_id"])
        .groupby(group_key)[horizon_col]
        .transform("median")
    )
    df[new_col] = np.nan
    mask = df[horizon_col].notna() & df["division_id"].notna()
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
    """Return the primary excess-return column for a given score type.

    HomeReady   -> 3Y appreciation CAGR excess vs division median
    InvestorEdge -> 3Y total return CAGR excess vs division median
    """
    if score_type == "homeready":
        return "excess_div_3y"
    elif score_type == "investoredge":
        return "excess_total_div_3y"
    else:
        raise ValueError(f"Unknown score type: {score_type}")


# ---------------------------------------------------------------------------
# Calibration training
# ---------------------------------------------------------------------------


def compute_calibration_mad(
    score_percentiles: np.ndarray,
    actual_percentiles: np.ndarray,
) -> float:
    """Mean Absolute Deviation between predicted and actual percentiles.

    Groups score percentiles into decile bins and compares each bin's average
    actual percentile to its predicted midpoint.
    """
    if len(score_percentiles) < 20:
        return float("nan")

    try:
        labels = pd.qcut(score_percentiles, 10, labels=False, duplicates="drop") + 1
    except ValueError:
        labels = (
            pd.Series(score_percentiles)
            .rank(method="first", pct=True)
            .pipe(lambda x: np.ceil(x * 10).astype(int).clip(1, 10))
            .values
        )

    deviations = []
    max_label = max(labels)
    for d in sorted(set(labels)):
        mask = labels == d
        predicted_pctile = (d - 0.5) / max_label * 100
        actual_pctile = float(np.mean(actual_percentiles[mask]))
        deviations.append(abs(actual_pctile - predicted_pctile))

    return float(np.mean(deviations))


def train_isotonic_model(
    df_subset: pd.DataFrame,
    score_type: str,
    geo_level: str,
) -> Optional[dict]:
    """Train an isotonic regression model for one (score_type, geo_level).

    Steps:
      1. Select the target column (with fallback for InvestorEdge).
      2. Convert scores and excess returns to percentiles.
      3. Fit IsotonicRegression(y_min=0, y_max=100, increasing=True).
      4. Evaluate the lookup table at every 5th percentile point.
      5. Log before/after MAD.

    Returns:
        A dict with the lookup table and diagnostics, or None if insufficient data.
    """
    from sklearn.isotonic import IsotonicRegression

    target = target_col_for_score(score_type)

    # Check coverage; fall back for InvestorEdge if total-return data is sparse
    n_with_target = int(df_subset[target].notna().sum())
    if (
        n_with_target < len(df_subset) * MIN_TARGET_COVERAGE_FRACTION
        and target != "excess_div_3y"
    ):
        logger.warning(
            "%s/%s: target '%s' has only %d/%d rows (%.1f%%). "
            "Falling back to excess_div_3y.",
            score_type,
            geo_level,
            target,
            n_with_target,
            len(df_subset),
            100 * n_with_target / max(len(df_subset), 1),
        )
        target = "excess_div_3y"
        n_with_target = int(df_subset[target].notna().sum())

    valid = df_subset.dropna(subset=["score_value", target])
    n_valid = len(valid)

    if n_valid < MIN_SAMPLES_FOR_TRAINING:
        logger.warning(
            "%s/%s: only %d valid rows (need %d). Skipping.",
            score_type,
            geo_level,
            n_valid,
            MIN_SAMPLES_FOR_TRAINING,
        )
        return None

    scores = valid["score_value"].values
    excess = valid[target].values

    # Convert to percentile ranks (0-100)
    score_percentiles = (
        pd.Series(scores).rank(method="average", pct=True).values * 100
    )
    excess_percentiles = (
        pd.Series(excess).rank(method="average", pct=True).values * 100
    )

    # Before calibration MAD (identity mapping: predicted pctile = actual pctile?)
    before_mad = compute_calibration_mad(score_percentiles, excess_percentiles)

    # Train isotonic regression
    iso_reg = IsotonicRegression(y_min=0, y_max=100, increasing=True)
    iso_reg.fit(score_percentiles, excess_percentiles)

    # Generate calibrated predictions at each grid point
    grid = np.array(LOOKUP_GRID, dtype=float)
    calibrated = iso_reg.predict(grid)

    # After calibration MAD (using the model's predictions)
    predicted_calibrated = iso_reg.predict(score_percentiles)
    after_mad = compute_calibration_mad(predicted_calibrated, excess_percentiles)

    # Build the lookup table (NaN → identity fallback for edge grid points)
    lookup_table = [
        {
            "raw": float(raw),
            "calibrated": round(float(cal), 1) if not np.isnan(cal) else float(raw),
        }
        for raw, cal in zip(grid, calibrated)
    ]

    logger.info(
        "%s/%s: n=%d, target=%s, MAD before=%.2f, MAD after=%.2f",
        score_type,
        geo_level,
        n_valid,
        target,
        before_mad,
        after_mad,
    )

    return {
        "lookup_table": lookup_table,
        "diagnostics": {
            "score_type": score_type,
            "geo_level": geo_level,
            "target_column": target,
            "n_samples": n_valid,
            "mad_before_calibration": round(before_mad, 2),
            "mad_after_calibration": round(after_mad, 2),
            "mad_improvement": round(before_mad - after_mad, 2),
        },
    }


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def run_calibration_pipeline(
    conn_string: str,
    geo_levels: list[str],
    score_types: list[str],
) -> dict:
    """Train calibration models for all requested (score_type, geo_level) combos.

    Returns:
        A dict keyed by "{score_type}_{geo_level}" with lookup table arrays.
    """
    calibration_tables: dict = {}
    diagnostics_list: list[dict] = []

    for geo_level in geo_levels:
        logger.info("=" * 60)
        logger.info("Loading backtest data for %s ...", geo_level.upper())
        logger.info("=" * 60)

        df_raw = load_backtest_data(conn_string, geo_level=geo_level)
        if df_raw.empty:
            logger.warning("No data for %s. Skipping.", geo_level)
            continue

        logger.info("Computing excess returns vs division medians ...")
        df = compute_excess_returns(df_raw)

        for score_type in score_types:
            key = f"{score_type}_{geo_level}"
            logger.info("-" * 40)
            logger.info("Training calibration model: %s", key)
            logger.info("-" * 40)

            df_subset = df[df["score_type"] == score_type].copy()
            if df_subset.empty:
                logger.warning("No data for %s/%s. Skipping.", score_type, geo_level)
                continue

            result = train_isotonic_model(df_subset, score_type, geo_level)
            if result is None:
                continue

            calibration_tables[key] = result["lookup_table"]
            diagnostics_list.append(result["diagnostics"])

    return {
        "tables": calibration_tables,
        "diagnostics": diagnostics_list,
    }


def write_output(
    calibration_tables: dict,
    diagnostics: list[dict],
    output_dir: Path,
    backend_dir: Path,
) -> None:
    """Write calibration tables to both output locations.

    Writes:
      1. Full output with diagnostics to output_dir/calibration_tables.json
      2. Tables-only to backend_dir/calibration-tables.json
    """
    # Build the output JSON (tables only, matching the specified format)
    tables_only = calibration_tables

    # Full output with metadata for the analysis directory
    full_output = {
        "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "description": (
            "Isotonic calibration lookup tables mapping raw score percentile "
            "to calibrated excess-return percentile."
        ),
        "lookup_grid_step": 5,
        "tables": tables_only,
        "diagnostics": diagnostics,
    }

    # Write to analysis output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    analysis_path = output_dir / "calibration_tables.json"
    with open(analysis_path, "w", encoding="utf-8") as f:
        json.dump(full_output, f, indent=2)
    logger.info("Full calibration output written to %s", analysis_path)

    # Write tables-only to backend directory
    backend_dir.mkdir(parents=True, exist_ok=True)
    backend_path = backend_dir / "calibration-tables.json"
    with open(backend_path, "w", encoding="utf-8") as f:
        json.dump(tables_only, f, indent=2)
    logger.info("Backend calibration tables written to %s", backend_path)


def print_summary(diagnostics: list[dict]) -> None:
    """Print a human-readable summary table to stdout."""
    sep = "=" * 72
    print(f"\n{sep}")
    print("  ISOTONIC CALIBRATION TRAINING SUMMARY")
    print(sep)

    if not diagnostics:
        print("  No models trained (insufficient data).")
        print(sep)
        return

    print(
        f"  {'Model':<25s}  {'N':>6s}  {'Target':<22s}  "
        f"{'MAD Before':>10s}  {'MAD After':>10s}  {'Improvement':>11s}"
    )
    print(f"  {'-'*25}  {'-'*6}  {'-'*22}  {'-'*10}  {'-'*10}  {'-'*11}")

    for diag in diagnostics:
        model_key = f"{diag['score_type']}/{diag['geo_level']}"
        print(
            f"  {model_key:<25s}  {diag['n_samples']:>6d}  "
            f"{diag['target_column']:<22s}  "
            f"{diag['mad_before_calibration']:>10.2f}  "
            f"{diag['mad_after_calibration']:>10.2f}  "
            f"{diag['mad_improvement']:>+10.2f}"
        )

    print(sep)
    print()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Train isotonic calibration models for PropertyIQ scores. "
            "Maps raw score percentiles to calibrated excess-return percentiles."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python train_calibration.py
  python train_calibration.py --geo-level metro
  python train_calibration.py --output-dir ./custom_output
  python train_calibration.py --score-type homeready --geo-level county
        """,
    )
    parser.add_argument(
        "--score-type",
        choices=["homeready", "investoredge", "both"],
        default="both",
        help="Which score type(s) to train (default: both)",
    )
    parser.add_argument(
        "--geo-level",
        choices=["metro", "county", "all"],
        default="all",
        help="Geography level to train (default: all = metro + county)",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Output directory for analysis JSON (default: scripts/analysis/output/)",
    )
    parser.add_argument(
        "--backend-dir",
        default=None,
        help=(
            "Backend directory for calibration-tables.json "
            "(default: packages/backend/src/scoring/calibration/)"
        ),
    )

    args = parser.parse_args()

    # Resolve paths relative to this script's location
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent.parent  # scripts/analysis -> repo root

    if args.output_dir:
        output_dir = Path(args.output_dir)
        if not output_dir.is_absolute():
            output_dir = script_dir / output_dir
    else:
        output_dir = script_dir / "output"

    if args.backend_dir:
        backend_dir = Path(args.backend_dir)
        if not backend_dir.is_absolute():
            backend_dir = script_dir / backend_dir
    else:
        backend_dir = repo_root / "packages" / "backend" / "src" / "scoring" / "calibration"

    # Determine score types and geo levels
    if args.score_type == "both":
        score_types = SCORE_TYPES
    else:
        score_types = [args.score_type]

    if args.geo_level == "all":
        geo_levels = GEO_LEVELS
    else:
        geo_levels = [args.geo_level]

    logger.info("=" * 60)
    logger.info("PropertyIQ Isotonic Calibration Training")
    logger.info("  Score types: %s", ", ".join(score_types))
    logger.info("  Geo levels:  %s", ", ".join(geo_levels))
    logger.info("  Output dir:  %s", output_dir)
    logger.info("  Backend dir: %s", backend_dir)
    logger.info("=" * 60)

    # Connect to database
    logger.info("Building database connection string ...")
    conn_string = _get_connection_string()

    # Run the calibration pipeline
    result = run_calibration_pipeline(conn_string, geo_levels, score_types)

    if not result["tables"]:
        logger.error("No calibration models were trained. Check data availability.")
        sys.exit(1)

    # Write output files
    write_output(result["tables"], result["diagnostics"], output_dir, backend_dir)

    # Print summary
    print_summary(result["diagnostics"])

    logger.info("Calibration training complete.")


if __name__ == "__main__":
    main()
