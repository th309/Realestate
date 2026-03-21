"""Load training parquet files, compute composite targets, identify feature columns."""

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from .config import (
    INVESTOREDGE_COMPOSITE_COMPONENTS,
    LEAKY_FEATURE_EXACT,
    LEAKY_FEATURE_PREFIXES,
    META_COLUMNS,
    OUTCOME_COLUMNS,
    TARGET_COLUMNS,
    TRAINING_DATA_DIR,
)

logger = logging.getLogger(__name__)


def load_training_data(geo_level: str, data_dir: Path | None = None) -> pd.DataFrame:
    """Load joined_{geo}.parquet and return raw DataFrame."""
    data_dir = data_dir or TRAINING_DATA_DIR
    path = data_dir / f"joined_{geo_level}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Training data not found: {path}")

    logger.info("Loading %s (%s)", path.name, _format_size(path.stat().st_size))
    df = pd.read_parquet(path)
    logger.info("Loaded %d rows × %d columns, %d unique geos",
                df.shape[0], df.shape[1], df["_geo_id"].nunique())
    return df


def compute_investoredge_composite(
    df: pd.DataFrame, horizon: str,
) -> tuple[pd.Series, bool]:
    """Compute investoredge composite target: appreciation excess + rent excess.

    Falls back to pure appreciation when rent data is too sparse (<10% coverage).

    Returns (target_series, is_composite). When is_composite is False, the target
    is identical to HomeReady's excess_vs_state target.
    """
    components = INVESTOREDGE_COMPOSITE_COMPONENTS.get(horizon)
    if components is None:
        # No composite formula for this horizon, fall back to excess_vs_state
        fallback_col = f"excess_vs_state_{horizon}"
        if fallback_col in df.columns:
            return df[fallback_col], False
        return pd.Series(np.nan, index=df.index), False

    appreciation_col = components["appreciation"]
    rent_col = components["rent_excess"]

    if appreciation_col not in df.columns:
        return pd.Series(np.nan, index=df.index), False

    appreciation = df[appreciation_col]

    if rent_col in df.columns:
        rent = df[rent_col]
        rent_coverage = rent.notna().mean()
        if rent_coverage >= 0.10:
            # Composite: appreciation excess + rent excess
            composite = appreciation + rent.fillna(0)
            logger.info("InvestorEdge %s composite: appreciation + rent (%.0f%% rent coverage)",
                        horizon, rent_coverage * 100)
            return composite, True

    logger.info("InvestorEdge %s: falling back to pure appreciation (rent too sparse)", horizon)
    return appreciation, False


def prepare_target(
    df: pd.DataFrame, score_type: str, horizon: str,
) -> tuple[pd.Series, bool] | None:
    """Compute/extract target column for a given score_type × horizon.

    Returns (target_series, is_unique_target) or None if target is unavailable.
    is_unique_target is False when InvestorEdge falls back to pure appreciation
    (identical to HomeReady's target), True otherwise.
    """
    key = (score_type, horizon)
    target_col = TARGET_COLUMNS.get(key)
    if target_col is None:
        logger.warning("No target defined for %s/%s", score_type, horizon)
        return None

    # InvestorEdge composite is computed dynamically
    if target_col.startswith("__investoredge_composite_"):
        series, is_composite = compute_investoredge_composite(df, horizon)
        if series.notna().sum() < 50:
            logger.warning("InvestorEdge %s target has <50 non-null rows, skipping", horizon)
            return None
        non_null_pct = series.notna().mean() * 100
        logger.info("Target investoredge_%s: %.1f%% non-null (%d rows), composite=%s",
                    horizon, non_null_pct, series.notna().sum(), is_composite)
        return series, is_composite

    if target_col not in df.columns:
        logger.warning("Target column '%s' not found for %s/%s", target_col, score_type, horizon)
        return None

    target = df[target_col]
    non_null_pct = target.notna().mean() * 100
    logger.info("Target %s: %.1f%% non-null (%d rows)", target_col, non_null_pct, target.notna().sum())

    if target.notna().sum() < 50:
        logger.warning("Target %s has <50 non-null rows, skipping", target_col)
        return None

    return target, True


def identify_feature_columns(df: pd.DataFrame) -> list[str]:
    """Identify usable feature columns by excluding outcomes, meta, and leaky features."""
    all_cols = set(df.columns)

    # Remove meta and outcome columns
    exclude = set(META_COLUMNS) | set(OUTCOME_COLUMNS)

    # Remove any internal columns (prefixed with __)
    for col in all_cols:
        if col.startswith("__"):
            exclude.add(col)

    # Remove leaky features (prefix match)
    for col in all_cols:
        for prefix in LEAKY_FEATURE_PREFIXES:
            if col.startswith(prefix):
                exclude.add(col)
                break

    # Remove exact-match exclusions
    exclude.update(LEAKY_FEATURE_EXACT)

    # Only keep numeric columns
    numeric_cols = set(df.select_dtypes(include=[np.number]).columns)

    features = sorted((all_cols - exclude) & numeric_cols)
    logger.info("Identified %d candidate features (excluded %d leaky/meta/outcome)",
                len(features), len(exclude & all_cols))
    return features


def prepare_dataset(
    geo_level: str,
    score_type: str,
    horizon: str,
    data_dir: Path | None = None,
) -> tuple[pd.DataFrame, pd.Series, list[str], pd.DataFrame, bool] | None:
    """Full data preparation pipeline for one geo × score_type × horizon.

    Returns (X, y, feature_names, meta_df, is_unique_target) or None if target
    is unavailable. is_unique_target is False when InvestorEdge falls back to
    the same target as HomeReady (pure appreciation).
    """
    df = load_training_data(geo_level, data_dir)

    # Compute target
    result = prepare_target(df, score_type, horizon)
    if result is None:
        return None

    target, is_unique_target = result

    # Add computed target to df for filtering
    df["__target"] = target

    # Filter to rows with non-null target
    mask = df["__target"].notna()
    df_filtered = df[mask].copy()
    target_filtered = df_filtered["__target"]

    logger.info("After target filter: %d rows (%.1f%%)",
                len(df_filtered), mask.mean() * 100)

    # Identify features
    feature_cols = identify_feature_columns(df_filtered)

    X = df_filtered[feature_cols]
    y = target_filtered
    meta = df_filtered[["_geo_id", "_period"]].copy()

    return X, y, feature_cols, meta, is_unique_target


def _format_size(size_bytes: int) -> str:
    """Format file size for logging."""
    if size_bytes >= 1_000_000_000:
        return f"{size_bytes / 1_000_000_000:.1f} GB"
    if size_bytes >= 1_000_000:
        return f"{size_bytes / 1_000_000:.0f} MB"
    return f"{size_bytes / 1_000:.0f} KB"
