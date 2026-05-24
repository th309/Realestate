"""LightGBM + SHAP feature importance ranker.

Inputs: a (region_id, period_date) feature panel and an excess_3y target.
Output: a ranked list of features by mean(|SHAP|) computed over 5 walk-
forward folds.

LightGBM with default monotonic constraints OFF — we let the tree discover
direction. Discovery is forgiving; the production model is ridge.
"""

import numpy as np
import pandas as pd
import lightgbm as lgb
import shap


LGB_PARAMS = {
    "objective": "regression",
    "learning_rate": 0.05,
    "n_estimators": 500,
    "max_depth": 6,
    "num_leaves": 31,
    "min_data_in_leaf": 50,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 5,
    "verbose": -1,
}


def rank_features(
    panel: pd.DataFrame,
    target_col: str,
    feature_cols: list[str],
    year_col: str = "year",
) -> pd.DataFrame:
    """Walk-forward LightGBM, SHAP global importance, returned ranked.

    Trains on progressively expanding windows (first 2 years, then 3, etc.)
    and tests on the following year. Accumulates SHAP values across all
    test folds, then ranks by mean(|SHAP|).

    Args:
        panel: DataFrame with at least (year_col, target_col, *feature_cols).
        target_col: Name of the target column (e.g., "excess_3y").
        feature_cols: List of feature column names to rank.
        year_col: Name of the year column (default "year").

    Returns:
        DataFrame with columns: feature, mean_abs_shap, ranked_position.
    """
    years = sorted(panel[year_col].dropna().unique())
    if len(years) < 4:
        raise ValueError(
            f"Need at least 4 distinct years for walk-forward; got {len(years)}"
        )

    shap_sums = pd.Series(0.0, index=feature_cols)
    n_rows_seen = 0

    for i in range(2, len(years)):
        train_years = years[:i]
        test_year = years[i]
        train = panel[panel[year_col].isin(train_years)].dropna(
            subset=[target_col]
        )
        test = panel[panel[year_col] == test_year].dropna(subset=[target_col])

        if len(train) < 500 or len(test) < 100:
            continue

        X_tr = train[feature_cols].values
        y_tr = train[target_col].values
        X_te = test[feature_cols].values

        model = lgb.LGBMRegressor(**LGB_PARAMS)
        model.fit(X_tr, y_tr)

        explainer = shap.TreeExplainer(model)
        sv = explainer.shap_values(X_te)
        shap_sums = shap_sums.add(
            pd.Series(np.abs(sv).sum(axis=0), index=feature_cols),
            fill_value=0,
        )
        n_rows_seen += len(test)

    if n_rows_seen == 0:
        raise RuntimeError(
            "No usable walk-forward folds — check panel size and year coverage"
        )

    mean_abs_shap = (shap_sums / n_rows_seen).sort_values(ascending=False)
    return pd.DataFrame(
        {
            "feature": mean_abs_shap.index,
            "mean_abs_shap": mean_abs_shap.values,
            "ranked_position": range(1, len(mean_abs_shap) + 1),
        }
    )
