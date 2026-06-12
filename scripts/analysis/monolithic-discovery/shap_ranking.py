"""Walk-forward LightGBM + SHAP feature ranking per geo level.

For each level: train on vintages <= year N, explain the year N+1 test set,
accumulate mean |SHAP| per feature. Importance is normalized within each
level (share of total |SHAP|), then averaged across levels so metro, county,
and zip each get an equal vote — a feature must matter everywhere to rank
highly, matching the monolithic-formula constraint.

Univariate monthly Spearman IC per feature is reported alongside as a sanity
check and to fix each feature's direction (sign) for the formula search.

Usage:
    python shap_ranking.py
"""

import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
import shap
from scipy.stats import spearmanr

DATA_DIR = Path(__file__).parent / "data"
LEVELS = ["metro", "county", "zip"]
TARGET = "excess_3y"
SEED = 42

# Cap SHAP explanation rows per fold so the zip level stays tractable.
MAX_SHAP_ROWS_PER_FOLD = 60_000

LGB_PARAMS = {
    "objective": "regression",
    "n_estimators": 300,
    "learning_rate": 0.05,
    "num_leaves": 63,
    "min_child_samples": 100,
    "feature_fraction": 0.9,
    "verbosity": -1,
    "seed": SEED,
}


def walk_forward_folds(months: pd.Series) -> list[tuple[int, int]]:
    """(train_through_year, test_year) pairs; needs >=2 training years."""
    years = sorted(months.dt.year.unique())
    return [(years[i], years[i + 1]) for i in range(1, len(years) - 1)]


def shap_importance_for_level(level: str) -> tuple[pd.Series, pd.Series]:
    panel = pd.read_parquet(DATA_DIR / f"panel_{level}.parquet")
    features = [c for c in panel.columns if c.startswith("z_")]
    panel = panel.dropna(subset=[TARGET])
    months = panel["month"]

    abs_shap_sum = pd.Series(0.0, index=features)
    rows_explained = 0
    rng = np.random.default_rng(SEED)

    for train_through, test_year in walk_forward_folds(months):
        train = panel[months.dt.year <= train_through]
        test = panel[months.dt.year == test_year]
        if len(train) < 5_000 or len(test) == 0:
            continue
        model = lgb.LGBMRegressor(**LGB_PARAMS)
        model.fit(train[features], train[TARGET])

        if len(test) > MAX_SHAP_ROWS_PER_FOLD:
            test = test.iloc[
                rng.choice(len(test), MAX_SHAP_ROWS_PER_FOLD, replace=False)
            ]
        explainer = shap.TreeExplainer(model)
        values = explainer.shap_values(test[features])
        abs_shap_sum += pd.Series(
            np.abs(values).sum(axis=0), index=features
        )
        rows_explained += len(test)
        print(f"  [{level}] fold train<={train_through} test={test_year}: "
              f"train={len(train):,} explained={len(test):,}")

    mean_abs = abs_shap_sum / max(rows_explained, 1)
    normalized = mean_abs / mean_abs.sum()

    # Univariate monthly Spearman IC (median across months) per feature.
    ics = {}
    for col in features:
        monthly = []
        for _, grp in panel.groupby("month"):
            valid = grp[[col, TARGET]].dropna()
            if len(valid) >= 30:
                ic, _ = spearmanr(valid[col], valid[TARGET])
                monthly.append(ic)
        ics[col] = float(np.median(monthly)) if monthly else np.nan
    return normalized, pd.Series(ics)


def main() -> None:
    importances, univariate = {}, {}
    for level in LEVELS:
        print(f"[{level}] ranking…")
        imp, uni = shap_importance_for_level(level)
        importances[level] = imp
        univariate[level] = uni

    imp_df = pd.DataFrame(importances)
    imp_df["aggregate"] = imp_df[LEVELS].mean(axis=1)
    imp_df = imp_df.sort_values("aggregate", ascending=False)
    uni_df = pd.DataFrame(univariate)

    result = {
        "shap_share": {
            lvl: importances[lvl].round(4).to_dict() for lvl in LEVELS
        },
        "aggregate_rank": imp_df["aggregate"].round(4).to_dict(),
        "univariate_median_ic": {
            lvl: uni_df[lvl].round(4).to_dict() for lvl in LEVELS
        },
    }
    out = DATA_DIR / "shap_ranking.json"
    out.write_text(json.dumps(result, indent=2))

    print("\n=== SHAP importance (share of |SHAP|, by level) ===")
    print(imp_df.round(4).to_string())
    print("\n=== Univariate median monthly Spearman IC ===")
    print(uni_df.round(4).to_string())
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
