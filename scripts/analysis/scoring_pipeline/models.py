"""Model wrappers with uniform interface: fit/predict/get_feature_importances."""

import logging
from abc import ABC, abstractmethod

import numpy as np
import pandas as pd
from sklearn.linear_model import ElasticNetCV
from sklearn.preprocessing import StandardScaler

from .config import ELASTICNET_DEFAULTS, LIGHTGBM_DEFAULTS, XGBOOST_DEFAULTS

logger = logging.getLogger(__name__)


class BaseModel(ABC):
    """Uniform interface for all model types."""

    name: str

    @abstractmethod
    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        ...

    @abstractmethod
    def predict(self, X: np.ndarray) -> np.ndarray:
        ...

    @abstractmethod
    def get_feature_importances(self, feature_names: list[str]) -> dict[str, float]:
        """Return {feature_name: importance} dict, normalized to sum=1."""
        ...

    @property
    def is_tree_model(self) -> bool:
        return False


class ElasticNetModel(BaseModel):
    """ElasticNet with CV-tuned alpha/l1_ratio and StandardScaler."""

    name = "elasticnet"

    def __init__(self, **kwargs):
        defaults = ELASTICNET_DEFAULTS.copy()
        defaults.update(kwargs)
        self.scaler = StandardScaler()
        self.model = ElasticNetCV(
            l1_ratio=defaults["l1_ratio"],
            alphas=defaults["n_alphas"],
            cv=defaults["cv"],
            max_iter=defaults["max_iter"],
            random_state=defaults["random_state"],
        )
        self._feature_names: list[str] = []

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)

    def predict(self, X: np.ndarray) -> np.ndarray:
        X_scaled = self.scaler.transform(X)
        return self.model.predict(X_scaled)

    def get_feature_importances(self, feature_names: list[str]) -> dict[str, float]:
        coefs = np.abs(self.model.coef_)
        total = coefs.sum()
        if total == 0:
            return {f: 0.0 for f in feature_names}
        normalized = coefs / total
        return {f: float(v) for f, v in zip(feature_names, normalized)}


class XGBoostModel(BaseModel):
    """XGBoost regressor with conservative defaults."""

    name = "xgboost"

    def __init__(self, **kwargs):
        import xgboost as xgb
        defaults = XGBOOST_DEFAULTS.copy()
        defaults.update(kwargs)
        self.model = xgb.XGBRegressor(**defaults)

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        self.model.fit(X, y)

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict(X)

    def get_feature_importances(self, feature_names: list[str]) -> dict[str, float]:
        importances = self.model.feature_importances_
        total = importances.sum()
        if total == 0:
            return {f: 0.0 for f in feature_names}
        normalized = importances / total
        return {f: float(v) for f, v in zip(feature_names, normalized)}

    @property
    def is_tree_model(self) -> bool:
        return True


class LightGBMModel(BaseModel):
    """LightGBM regressor with conservative defaults."""

    name = "lightgbm"

    def __init__(self, **kwargs):
        import lightgbm as lgb
        defaults = LIGHTGBM_DEFAULTS.copy()
        defaults.update(kwargs)
        self.model = lgb.LGBMRegressor(**defaults)

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        # Use numpy arrays to avoid feature name mismatch warnings
        X_arr = np.asarray(X) if not isinstance(X, np.ndarray) else X
        self.model.fit(X_arr, y)

    def predict(self, X: np.ndarray) -> np.ndarray:
        X_arr = np.asarray(X) if not isinstance(X, np.ndarray) else X
        return self.model.predict(X_arr)

    def get_feature_importances(self, feature_names: list[str]) -> dict[str, float]:
        importances = self.model.feature_importances_.astype(float)
        total = importances.sum()
        if total == 0:
            return {f: 0.0 for f in feature_names}
        normalized = importances / total
        return {f: float(v) for f, v in zip(feature_names, normalized)}

    @property
    def is_tree_model(self) -> bool:
        return True


def get_all_models() -> list[BaseModel]:
    """Instantiate all model types for the tournament."""
    models = [ElasticNetModel()]

    try:
        models.append(XGBoostModel())
    except ImportError:
        logger.warning("xgboost not installed, skipping XGBoost model")

    try:
        models.append(LightGBMModel())
    except ImportError:
        logger.warning("lightgbm not installed, skipping LightGBM model")

    logger.info("Tournament models: %s", [m.name for m in models])
    return models
