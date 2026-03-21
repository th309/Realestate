"""SHAP-based weight extraction from tree models."""

import logging

import numpy as np
import pandas as pd

from .config import SHAP_MAX_SAMPLES, SHAP_MIN_WEIGHT

logger = logging.getLogger(__name__)


def extract_shap_weights(
    model,
    X: pd.DataFrame,
    feature_names: list[str],
    max_samples: int = SHAP_MAX_SAMPLES,
    min_weight: float = SHAP_MIN_WEIGHT,
) -> dict:
    """Extract linear-style weights from a tree model via SHAP values.

    Returns:
        {
            "weights": { feature: { "weight": float, "direction": 1|-1 } },
            "raw_shap_importance": { feature: float },
            "n_samples": int,
        }
    """
    import shap

    # Subsample if dataset is large
    if len(X) > max_samples:
        X_sample = X.sample(n=max_samples, random_state=42)
        logger.info("SHAP: subsampled %d → %d rows", len(X), max_samples)
    else:
        X_sample = X

    X_values = X_sample[feature_names].values

    # Use TreeExplainer for tree-based models
    underlying_model = model.model  # unwrap our wrapper
    explainer = shap.TreeExplainer(underlying_model)
    shap_values = explainer.shap_values(X_values)

    # Mean |SHAP| per feature → importance
    mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
    # Mean SHAP (signed) → direction
    mean_shap = np.mean(shap_values, axis=0)

    # Normalize to sum = 1
    total = mean_abs_shap.sum()
    if total == 0:
        logger.warning("SHAP: all values are zero")
        return {"weights": {}, "raw_shap_importance": {}, "n_samples": len(X_sample)}

    normalized = mean_abs_shap / total

    # Build weights dict
    weights = {}
    raw_importance = {}
    for i, feat in enumerate(feature_names):
        raw_importance[feat] = float(mean_abs_shap[i])
        weight = float(normalized[i])
        if weight >= min_weight:
            direction = 1 if mean_shap[i] >= 0 else -1
            weights[feat] = {"weight": round(weight, 4), "direction": direction}

    # Re-normalize after filtering
    weight_sum = sum(w["weight"] for w in weights.values())
    if weight_sum > 0:
        for feat in weights:
            weights[feat]["weight"] = round(weights[feat]["weight"] / weight_sum, 4)

    logger.info("SHAP weights: %d features (from %d), top: %s",
                len(weights), len(feature_names),
                list(weights.keys())[:5])

    return {
        "weights": weights,
        "raw_shap_importance": {k: round(v, 6) for k, v in raw_importance.items()},
        "n_samples": len(X_sample),
    }


def extract_linear_weights(model, feature_names: list[str]) -> dict:
    """Extract weights from a linear model (ElasticNet) via coefficients.

    Returns same format as extract_shap_weights for consistency.
    """
    coefs = model.model.coef_
    abs_coefs = np.abs(coefs)
    total = abs_coefs.sum()

    if total == 0:
        return {"weights": {}, "raw_shap_importance": {}, "n_samples": 0}

    normalized = abs_coefs / total

    weights = {}
    raw_importance = {}
    for i, feat in enumerate(feature_names):
        raw_importance[feat] = float(abs_coefs[i])
        weight = float(normalized[i])
        if weight >= SHAP_MIN_WEIGHT:
            direction = 1 if coefs[i] >= 0 else -1
            weights[feat] = {"weight": round(weight, 4), "direction": direction}

    # Re-normalize
    weight_sum = sum(w["weight"] for w in weights.values())
    if weight_sum > 0:
        for feat in weights:
            weights[feat]["weight"] = round(weights[feat]["weight"] / weight_sum, 4)

    return {
        "weights": weights,
        "raw_shap_importance": {k: round(v, 6) for k, v in raw_importance.items()},
        "n_samples": 0,
    }
