"""Model-agnostic walk-forward cross-validation harness."""

import logging
from dataclasses import dataclass, field
from datetime import date
from dateutil.relativedelta import relativedelta

import numpy as np
import pandas as pd

from .config import (
    MIN_TEST_ROWS,
    WALK_FORWARD_SLIDE_MONTHS,
    WALK_FORWARD_START,
    WALK_FORWARD_TEST_MONTHS,
    WALK_FORWARD_TRAIN_MONTHS,
)
from .evaluation import compute_window_metrics
from .models import BaseModel

logger = logging.getLogger(__name__)


def _safe_round(value, ndigits: int = 4):
    """Round a value, returning 0 if None."""
    if value is None:
        return 0.0
    return round(value, ndigits)


@dataclass
class WindowResult:
    """Results from a single walk-forward window."""
    window_idx: int
    train_start: str
    train_end: str
    test_start: str
    test_end: str
    train_rows: int
    test_rows: int
    metrics: dict  # IC, quintile_spread, hit_rate, calibration_mad
    feature_importances: dict[str, float]


@dataclass
class WalkForwardResult:
    """Aggregated results from walk-forward CV for one model."""
    model_name: str
    windows: list[WindowResult] = field(default_factory=list)

    @property
    def mean_ic(self) -> float:
        ics = [w.metrics["ic"] for w in self.windows if w.metrics.get("ic") is not None]
        return float(np.mean(ics)) if ics else 0.0

    @property
    def std_ic(self) -> float:
        ics = [w.metrics["ic"] for w in self.windows if w.metrics.get("ic") is not None]
        return float(np.std(ics)) if len(ics) > 1 else 0.0

    @property
    def information_ratio(self) -> float:
        """IC mean / IC std — higher is better."""
        if self.std_ic == 0:
            return 0.0
        return self.mean_ic / self.std_ic

    @property
    def mean_quintile_spread(self) -> float:
        vals = [w.metrics["quintile_spread"] for w in self.windows
                if w.metrics.get("quintile_spread") is not None]
        return float(np.mean(vals)) if vals else 0.0

    @property
    def mean_hit_rate(self) -> float:
        vals = [w.metrics["hit_rate"] for w in self.windows
                if w.metrics.get("hit_rate") is not None]
        return float(np.mean(vals)) if vals else 0.0

    @property
    def mean_calibration_mad(self) -> float:
        vals = [w.metrics["calibration_mad"] for w in self.windows
                if w.metrics.get("calibration_mad") is not None]
        return float(np.mean(vals)) if vals else 0.0

    @property
    def aggregated_importances(self) -> dict[str, float]:
        """Average feature importances across all windows."""
        if not self.windows:
            return {}
        all_features = set()
        for w in self.windows:
            all_features.update(w.feature_importances.keys())
        avg = {}
        for feat in all_features:
            vals = [w.feature_importances.get(feat, 0.0) for w in self.windows]
            avg[feat] = float(np.mean(vals))
        # Re-normalize
        total = sum(avg.values())
        if total > 0:
            avg = {k: v / total for k, v in avg.items()}
        return dict(sorted(avg.items(), key=lambda x: x[1], reverse=True))

    def to_dict(self) -> dict:
        return {
            "model_name": self.model_name,
            "n_windows": len(self.windows),
            "mean_ic": round(self.mean_ic, 4),
            "std_ic": round(self.std_ic, 4),
            "information_ratio": round(self.information_ratio, 4),
            "mean_quintile_spread": round(self.mean_quintile_spread, 4),
            "mean_hit_rate": round(self.mean_hit_rate, 4),
            "mean_calibration_mad": round(self.mean_calibration_mad, 4),
            "feature_importances": {k: round(v, 4) for k, v in self.aggregated_importances.items()},
            "windows": [
                {
                    "window": w.window_idx,
                    "train": f"{w.train_start} to {w.train_end}",
                    "test": f"{w.test_start} to {w.test_end}",
                    "train_rows": w.train_rows,
                    "test_rows": w.test_rows,
                    "ic": _safe_round(w.metrics.get("ic"), 4),
                    "quintile_spread": _safe_round(w.metrics.get("quintile_spread"), 4),
                    "hit_rate": _safe_round(w.metrics.get("hit_rate"), 4),
                }
                for w in self.windows
            ],
        }


def generate_windows(
    start: date = WALK_FORWARD_START,
    train_months: int = WALK_FORWARD_TRAIN_MONTHS,
    test_months: int = WALK_FORWARD_TEST_MONTHS,
    slide_months: int = WALK_FORWARD_SLIDE_MONTHS,
    max_windows: int = 20,
) -> list[tuple[date, date, date, date]]:
    """Generate walk-forward (train_start, train_end, test_start, test_end) tuples."""
    windows = []
    current_start = start
    for _ in range(max_windows):
        train_end = current_start + relativedelta(months=train_months) - relativedelta(days=1)
        test_start = train_end + relativedelta(days=1)
        test_end = test_start + relativedelta(months=test_months) - relativedelta(days=1)

        windows.append((current_start, train_end, test_start, test_end))
        current_start = current_start + relativedelta(months=slide_months)

    return windows


def run_walk_forward(
    model: BaseModel,
    X: pd.DataFrame,
    y: pd.Series,
    meta: pd.DataFrame,
    feature_names: list[str],
) -> WalkForwardResult:
    """Run walk-forward CV for a single model.

    X, y, meta must have aligned indices.
    meta must contain '_period' column (string dates "YYYY-MM-DD").
    """
    # Parse periods
    periods = pd.to_datetime(meta["_period"])

    windows = generate_windows()
    result = WalkForwardResult(model_name=model.name)

    logger.info("Running walk-forward CV for %s (%d windows, %d features)",
                model.name, len(windows), len(feature_names))

    for idx, (train_start, train_end, test_start, test_end) in enumerate(windows):
        train_start_ts = pd.Timestamp(train_start)
        train_end_ts = pd.Timestamp(train_end)
        test_start_ts = pd.Timestamp(test_start)
        test_end_ts = pd.Timestamp(test_end)

        train_mask = (periods >= train_start_ts) & (periods <= train_end_ts)
        test_mask = (periods >= test_start_ts) & (periods <= test_end_ts)

        X_train = X.loc[train_mask, feature_names]
        y_train = y.loc[train_mask]
        X_test = X.loc[test_mask, feature_names]
        y_test = y.loc[test_mask]

        if len(X_test) < MIN_TEST_ROWS:
            logger.debug("Window %d: skipped (only %d test rows)", idx, len(X_test))
            continue

        if len(X_train) < MIN_TEST_ROWS:
            logger.debug("Window %d: skipped (only %d train rows)", idx, len(X_train))
            continue

        # Impute NaN with training-set column medians (no leakage)
        # For columns that are all-NaN in training, use 0
        train_medians = X_train.median()
        train_medians = train_medians.fillna(0)
        X_train_filled = X_train.fillna(train_medians).fillna(0)
        X_test_filled = X_test.fillna(train_medians).fillna(0)

        # Also impute any remaining NaN in target
        y_train_filled = y_train.fillna(y_train.median())

        try:
            model.fit(X_train_filled.values, y_train_filled.values)
            predictions = model.predict(X_test_filled.values)
        except Exception as e:
            logger.warning("Window %d: model %s failed: %s", idx, model.name, e)
            continue

        # Compute metrics
        metrics = compute_window_metrics(y_test.values, predictions)
        importances = model.get_feature_importances(feature_names)

        window_result = WindowResult(
            window_idx=idx,
            train_start=str(train_start),
            train_end=str(train_end),
            test_start=str(test_start),
            test_end=str(test_end),
            train_rows=len(X_train),
            test_rows=len(X_test),
            metrics=metrics,
            feature_importances=importances,
        )
        result.windows.append(window_result)

        ic_val = metrics.get("ic") or 0
        qs_val = metrics.get("quintile_spread") or 0
        hr_val = (metrics.get("hit_rate") or 0) * 100
        logger.info("  Window %d [%s -> %s]: IC=%.3f, QS=%.3f, HR=%.1f%% (train=%d, test=%d)",
                     idx, test_start, test_end, ic_val, qs_val, hr_val,
                     len(X_train), len(X_test))

    if not result.windows:
        logger.warning("No valid windows for %s!", model.name)
    else:
        logger.info("%s: mean IC=%.4f (±%.4f), IR=%.2f, QS=%.4f, HR=%.1f%%",
                     model.name, result.mean_ic, result.std_ic,
                     result.information_ratio, result.mean_quintile_spread,
                     result.mean_hit_rate * 100)

    return result
