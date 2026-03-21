"""Feature selection: coverage filter → correlation filter → MI ranking."""

import logging

import numpy as np
import pandas as pd
from sklearn.feature_selection import mutual_info_regression

from .config import CORRELATION_THRESHOLD, COVERAGE_THRESHOLD, GEO_COVERAGE_THRESHOLD, MI_TOP_K

logger = logging.getLogger(__name__)


def coverage_filter(X: pd.DataFrame, threshold: float = COVERAGE_THRESHOLD) -> list[str]:
    """Drop features with less than `threshold` fraction of non-null values."""
    coverage = X.notna().mean()
    surviving = coverage[coverage >= threshold].index.tolist()
    dropped = len(X.columns) - len(surviving)
    logger.info("Coverage filter (>%.0f%%): %d → %d features (dropped %d)",
                threshold * 100, len(X.columns), len(surviving), dropped)

    if dropped > 0:
        worst = coverage[coverage < threshold].sort_values().head(5)
        for feat, cov in worst.items():
            logger.debug("  Dropped: %s (%.1f%% coverage)", feat, cov * 100)

    return surviving


def geo_consistency_filter(
    X: pd.DataFrame,
    geo_ids: pd.Series,
    threshold: float = GEO_COVERAGE_THRESHOLD,
) -> list[str]:
    """Drop features that aren't available for at least `threshold` fraction of unique geos.

    A feature passes if >= threshold of geos have at least one non-null value.
    This prevents features concentrated in a subset of geographies from being selected.
    """
    n_geos = geo_ids.nunique()
    surviving = []
    dropped_info = []

    for col in X.columns:
        # For each geo, check if it has at least one non-null value for this feature
        geo_has_data = X[col].groupby(geo_ids).apply(lambda x: x.notna().any())
        geo_coverage = geo_has_data.mean()
        if geo_coverage >= threshold:
            surviving.append(col)
        else:
            dropped_info.append((col, geo_coverage))

    dropped = len(X.columns) - len(surviving)
    logger.info("Geo consistency filter (>%.0f%% of geos): %d -> %d features (dropped %d)",
                threshold * 100, len(X.columns), len(surviving), dropped)

    if dropped_info:
        dropped_info.sort(key=lambda x: x[1])
        for feat, cov in dropped_info[:10]:
            logger.info("  Dropped: %s (%.1f%% of geos)", feat, cov * 100)

    return surviving


def correlation_filter(
    X: pd.DataFrame,
    y: pd.Series,
    threshold: float = CORRELATION_THRESHOLD,
) -> list[str]:
    """For feature pairs with |r| > threshold, drop the one with lower MI vs target.

    Uses pairwise complete observations for correlation.
    """
    features = list(X.columns)
    if len(features) <= 1:
        return features

    # Compute correlation matrix (pairwise complete)
    corr_matrix = X.corr().abs()

    # Compute MI for all features (fill NaN with median for MI calculation)
    X_filled = X.fillna(X.median())
    y_filled = y.fillna(y.median())
    mi_scores = mutual_info_regression(X_filled, y_filled, random_state=42, n_neighbors=5)
    mi_dict = dict(zip(features, mi_scores))

    # Find highly correlated pairs and decide which to drop
    to_drop = set()
    for i in range(len(features)):
        if features[i] in to_drop:
            continue
        for j in range(i + 1, len(features)):
            if features[j] in to_drop:
                continue
            if corr_matrix.iloc[i, j] > threshold:
                # Drop the one with lower MI
                fi, fj = features[i], features[j]
                if mi_dict[fi] >= mi_dict[fj]:
                    to_drop.add(fj)
                    logger.debug("  Corr filter: dropping %s (r=%.3f with %s, lower MI)",
                                 fj, corr_matrix.iloc[i, j], fi)
                else:
                    to_drop.add(fi)
                    logger.debug("  Corr filter: dropping %s (r=%.3f with %s, lower MI)",
                                 fi, corr_matrix.iloc[i, j], fj)

    surviving = [f for f in features if f not in to_drop]
    logger.info("Correlation filter (|r|>%.2f): %d → %d features (dropped %d)",
                threshold, len(features), len(surviving), len(to_drop))
    return surviving


def mi_ranking(
    X: pd.DataFrame,
    y: pd.Series,
    top_k: int = MI_TOP_K,
) -> list[tuple[str, float]]:
    """Rank features by mutual information with target, return top-K.

    Returns list of (feature_name, mi_score) tuples, sorted descending.
    """
    X_filled = X.fillna(X.median())
    y_filled = y.fillna(y.median())

    mi_scores = mutual_info_regression(X_filled, y_filled, random_state=42, n_neighbors=5)
    ranked = sorted(zip(X.columns, mi_scores), key=lambda x: x[1], reverse=True)

    top = ranked[:top_k]
    logger.info("MI ranking: top %d of %d features", len(top), len(ranked))
    for name, score in top:
        logger.info("  %s: MI=%.4f", name, score)

    return top


def select_features(
    X: pd.DataFrame,
    y: pd.Series,
    geo_ids: pd.Series | None = None,
    coverage_thresh: float = COVERAGE_THRESHOLD,
    geo_coverage_thresh: float = GEO_COVERAGE_THRESHOLD,
    corr_thresh: float = CORRELATION_THRESHOLD,
    top_k: int = MI_TOP_K,
) -> dict:
    """Full feature selection pipeline: coverage → geo consistency → correlation → MI ranking.

    Args:
        geo_ids: Series of geo IDs aligned with X/y index. When provided,
                 features must be available for >= geo_coverage_thresh of unique geos.

    Returns dict with selected features and metadata for caching.
    """
    logger.info("=== Feature Selection: %d candidates ===", len(X.columns))

    # Step 1: Coverage filter (overall row-level non-null rate)
    coverage_survivors = coverage_filter(X, coverage_thresh)
    if not coverage_survivors:
        logger.warning("No features survived coverage filter!")
        return {"selected_features": [], "mi_scores": {}, "all_stages": {}}

    # Step 2: Geo consistency filter (feature must exist for most geos)
    X_cov = X[coverage_survivors]
    if geo_ids is not None:
        geo_survivors = geo_consistency_filter(X_cov, geo_ids, geo_coverage_thresh)
        if not geo_survivors:
            logger.warning("No features survived geo consistency filter!")
            return {"selected_features": [], "mi_scores": {}, "all_stages": {}}
    else:
        geo_survivors = coverage_survivors

    # Step 3: Correlation filter
    X_geo = X[geo_survivors]
    corr_survivors = correlation_filter(X_geo, y, corr_thresh)
    if not corr_survivors:
        logger.warning("No features survived correlation filter!")
        return {"selected_features": [], "mi_scores": {}, "all_stages": {}}

    # Step 4: MI ranking
    X_corr = X[corr_survivors]
    top_features = mi_ranking(X_corr, y, top_k)

    selected_names = [name for name, _ in top_features]
    mi_scores = {name: float(score) for name, score in top_features}

    result = {
        "selected_features": selected_names,
        "mi_scores": mi_scores,
        "all_stages": {
            "initial_candidates": len(X.columns),
            "after_coverage": len(coverage_survivors),
            "after_geo_consistency": len(geo_survivors),
            "after_correlation": len(corr_survivors),
            "after_mi_ranking": len(selected_names),
            "coverage_threshold": coverage_thresh,
            "geo_coverage_threshold": geo_coverage_thresh,
            "correlation_threshold": corr_thresh,
            "mi_top_k": top_k,
        },
    }

    logger.info("Selected %d features: %s", len(selected_names), selected_names)
    return result
