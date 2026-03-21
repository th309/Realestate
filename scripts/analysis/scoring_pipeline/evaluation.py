"""Evaluation metrics: IC, quintile spread, hit rate, calibration MAD."""

import logging

import numpy as np
from scipy import stats

logger = logging.getLogger(__name__)


def compute_ic(y_true: np.ndarray, y_pred: np.ndarray) -> float | None:
    """Spearman rank correlation (Information Coefficient)."""
    if len(y_true) < 5:
        return None
    # Remove NaN pairs
    mask = ~(np.isnan(y_true) | np.isnan(y_pred))
    if mask.sum() < 5:
        return None
    corr, _ = stats.spearmanr(y_true[mask], y_pred[mask])
    return float(corr) if np.isfinite(corr) else None


def compute_quintile_spread(y_true: np.ndarray, y_pred: np.ndarray) -> float | None:
    """Mean actual return of top quintile minus bottom quintile of predictions.

    Measures the model's ability to separate good from bad outcomes.
    """
    if len(y_true) < 10:
        return None

    mask = ~(np.isnan(y_true) | np.isnan(y_pred))
    y_true_clean = y_true[mask]
    y_pred_clean = y_pred[mask]

    if len(y_true_clean) < 10:
        return None

    # Sort by predicted values
    sorted_idx = np.argsort(y_pred_clean)
    n = len(sorted_idx)
    q_size = n // 5

    if q_size < 2:
        return None

    bottom_quintile = y_true_clean[sorted_idx[:q_size]]
    top_quintile = y_true_clean[sorted_idx[-q_size:]]

    spread = float(np.mean(top_quintile) - np.mean(bottom_quintile))
    return spread




def compute_hit_rate(y_true: np.ndarray, y_pred: np.ndarray) -> float | None:
    """Fraction of top-quintile predictions that beat the median actual return."""
    if len(y_true) < 10:
        return None

    mask = ~(np.isnan(y_true) | np.isnan(y_pred))
    y_true_clean = y_true[mask]
    y_pred_clean = y_pred[mask]

    if len(y_true_clean) < 10:
        return None

    median_return = np.median(y_true_clean)
    sorted_idx = np.argsort(y_pred_clean)
    n = len(sorted_idx)
    q_size = n // 5

    if q_size < 2:
        return None

    top_quintile_actuals = y_true_clean[sorted_idx[-q_size:]]
    hit_rate = float(np.mean(top_quintile_actuals > median_return))
    return hit_rate


def compute_calibration_mad(y_true: np.ndarray, y_pred: np.ndarray, n_bins: int = 10) -> float | None:
    """Mean absolute deviation from perfect decile calibration.

    Bins predictions into deciles, computes mean actual in each bin,
    and measures how far the actual decile means deviate from the
    expected monotonic ordering.
    """
    if len(y_true) < n_bins * 3:
        return None

    mask = ~(np.isnan(y_true) | np.isnan(y_pred))
    y_true_clean = y_true[mask]
    y_pred_clean = y_pred[mask]

    if len(y_true_clean) < n_bins * 3:
        return None

    # Bin by predicted values
    sorted_idx = np.argsort(y_pred_clean)
    bin_size = len(sorted_idx) // n_bins

    bin_means = []
    for i in range(n_bins):
        start = i * bin_size
        end = start + bin_size if i < n_bins - 1 else len(sorted_idx)
        bin_actuals = y_true_clean[sorted_idx[start:end]]
        bin_means.append(float(np.mean(bin_actuals)))

    # Perfect calibration: bin means should be monotonically increasing
    # MAD = mean absolute deviation from a perfectly monotonic sequence
    bin_means_arr = np.array(bin_means)
    ideal = np.sort(bin_means_arr)  # monotonically sorted version
    mad = float(np.mean(np.abs(bin_means_arr - ideal)))
    return mad


def compute_window_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """Compute all evaluation metrics for a single window."""
    return {
        "ic": compute_ic(y_true, y_pred),
        "quintile_spread": compute_quintile_spread(y_true, y_pred),
        "hit_rate": compute_hit_rate(y_true, y_pred),
        "calibration_mad": compute_calibration_mad(y_true, y_pred),
    }


def select_best_model(model_results: list[dict]) -> dict | None:
    """Select best model by highest mean OOS IC (tiebreak: highest quintile spread).

    Each dict in model_results must have 'model_name', 'mean_ic', 'mean_quintile_spread'.
    Returns the winning model's result dict.
    """
    if not model_results:
        return None

    # Filter to models with valid IC
    valid = [r for r in model_results if r.get("mean_ic", 0) > 0]
    if not valid:
        # Fall back to all models if none have positive IC
        valid = model_results

    # Sort by (mean_ic desc, mean_quintile_spread desc)
    valid.sort(key=lambda r: (r.get("mean_ic", 0), r.get("mean_quintile_spread", 0)), reverse=True)

    winner = valid[0]
    logger.info("Best model: %s (IC=%.4f, QS=%.4f)",
                winner["model_name"], winner.get("mean_ic", 0), winner.get("mean_quintile_spread", 0))
    return winner
