# PropertyIQ Scoring Optimizer — Python Package Design

**Date:** 2026-03-01
**Status:** Approved
**Goal:** Build a Python statistics package to find optimal scoring weights and features through rigorous statistical analysis, improving OOS IC from 0.13-0.18 to 0.25+, widening quintile spread from 1.2-1.5pp to 3pp+, and fixing calibration MAD from 17-20pp to <10pp.

---

## 1. Problem Statement

The current scoring system (v2 elastic net weights in TypeScript) produces real but modest predictive signal:

- OOS IC: 0.13-0.18 (statistically significant but modest)
- Quintile spread: 1.2-1.5pp (top vs bottom quintile excess return)
- Calibration MAD: 17-20pp (scores rank correctly but magnitude is compressed)
- Beat-state-median rate: 53-60% for top quintile (slightly better than coin flip)
- Only 3-8 features used out of 74+ available metrics

A dedicated Python stats package can explore the full feature space, test nonlinear models, and find the ceiling of predictive power.

## 2. Architecture

### Package Structure

```
packages/scoring-optimizer/
├── pyproject.toml                    # uv/pip project config
├── scoring_optimizer/
│   ├── __init__.py
│   ├── cli.py                        # CLI: python -m scoring_optimizer <command>
│   ├── config.py                     # Supabase connection, constants
│   ├── data/
│   │   ├── __init__.py
│   │   ├── loader.py                 # Pull all tables from Supabase
│   │   ├── external.py              # External data sources (FRED, Google Trends)
│   │   ├── schema.py                 # Pydantic models for data shapes
│   │   └── cache.py                  # Local parquet caching
│   ├── features/
│   │   ├── __init__.py
│   │   ├── engineering.py            # Feature creation pipeline
│   │   ├── selection.py              # Importance ranking & pruning
│   │   └── registry.py              # Feature definitions (source of truth)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py                   # Abstract model interface
│   │   ├── linear.py                 # Elastic net, ridge, lasso
│   │   ├── tree.py                   # XGBoost, LightGBM, random forest
│   │   ├── neural.py                 # MLP, TabNet
│   │   ├── ensemble.py              # Stacking, blending
│   │   └── calibration.py           # Isotonic, Platt, quantile mapping
│   ├── validation/
│   │   ├── __init__.py
│   │   ├── walk_forward.py           # Walk-forward CV harness
│   │   ├── metrics.py               # IC, quintile spread, MAD, hit rate
│   │   └── bootstrap.py             # Significance testing
│   ├── optimization/
│   │   ├── __init__.py
│   │   ├── bayesian.py              # Optuna hyperparameter search
│   │   ├── regime.py                # Market regime detection
│   │   └── weight_search.py         # Direct weight optimization
│   ├── tracking/
│   │   ├── __init__.py
│   │   ├── experiment.py            # MLflow experiment setup & logging
│   │   └── compare.py              # Cross-experiment comparison
│   └── reporting/
│       ├── __init__.py
│       ├── comparison.py            # Old vs new model comparison
│       └── export.py                # Export weights → TypeScript formula-weights.ts
├── notebooks/
│   ├── 01_data_exploration.ipynb
│   ├── 02_feature_engineering.ipynb
│   ├── 03_model_tournament.ipynb
│   ├── 04_ensemble_optimization.ipynb
│   └── 05_final_report.ipynb
├── output/                          # Generated results, charts, exported weights
└── tests/
```

### Dependencies

- **Core:** pandas, numpy, scipy, scikit-learn
- **ML:** xgboost, lightgbm, pytorch (TabNet/MLP)
- **Optimization:** optuna (Bayesian hyperparameter search)
- **Tracking:** mlflow
- **Data:** supabase (Python client), pyarrow (parquet caching)
- **Visualization:** plotly, matplotlib, seaborn
- **External data:** fredapi (FRED economic data), pytrends (Google Trends)
- **Validation:** pydantic

## 3. Data Pipeline

### Internal Data (from Supabase)

Pull all metric tables:

- `zillow_state`, `zillow_metro`, `zillow_county`, `zillow_zip` — prices, rents, inventory
- `realtor_metro`, `realtor_county`, `realtor_zip` — hotness, demand, supply, DOM, pending
- Census tables — demographics, income, population, housing
- FRED tables — unemployment, GDP, economic indicators
- `propertyiq_backtest_outcomes` — actual 3Y returns (target variable)
- `propertyiq_scores` — existing scores for comparison
- `geography_crosswalk` — ZIP → county → metro → state linking

### External Data (new)

- **FRED API:** 30Y mortgage rates, 10Y treasury, unemployment claims, CPI, housing starts
- **S&P 500 / VIX:** Market regime indicators
- **Google Trends:** Housing-related search interest by state/metro
- **Building permits:** Already partially in DB (county level)

### Caching Strategy

First query downloads full tables and saves as parquet files in `output/cache/`. Subsequent runs load from cache. Cache invalidation via file age (configurable, default 24h).

## 4. Four-Phase Pipeline

### Phase 1: Feature Engineering (~800 candidate features)

| Category             | Examples                                       | Count    |
| -------------------- | ---------------------------------------------- | -------- |
| Raw metrics          | All 74+ as-is                                  | ~74      |
| YoY changes          | 12-month delta for each metric                 | ~74      |
| Momentum             | 3M, 6M rolling rate of change                  | ~148     |
| Cross-sectional rank | Percentile within state                        | ~74      |
| Interactions         | affordability × pop_growth, supply × demand    | ~30      |
| Lag structures       | Metric values 6M, 12M, 24M ago                 | ~222     |
| Rolling stats        | 6M, 12M rolling mean/std                       | ~148     |
| Regime indicators    | Mortgage rates, S&P returns, VIX, macro trends | ~10      |
| Relative value       | ZIP metric ÷ parent county metric              | ~30      |
| **Total**            |                                                | **~800** |

Feature selection pipeline:

1. Remove features with >50% missing values
2. Mutual information with target (filter low-MI features)
3. Correlation clustering (remove redundant features, keep best per cluster)
4. Permutation importance ranking
5. Stability filter: feature must appear in >=50% of walk-forward windows with |importance| >= threshold
6. **Final set: 20-50 features**

### Phase 2: Model Tournament

10 model types, identical walk-forward CV, all logged to MLflow:

| Model            | Type   | Why                              |
| ---------------- | ------ | -------------------------------- |
| Elastic Net      | Linear | Current baseline                 |
| Ridge            | Linear | Better for correlated features   |
| Lasso            | Linear | Aggressive feature selection     |
| PCA + Ridge      | Linear | Dimensionality reduction         |
| Random Forest    | Tree   | Nonlinear, interaction detection |
| XGBoost          | Tree   | SOTA for tabular data            |
| LightGBM         | Tree   | Fast, competitive accuracy       |
| MLP              | Deep   | Complex feature combinations     |
| TabNet           | Deep   | Attention-based, interpretable   |
| Stacked Ensemble | Meta   | Combines top performers          |

Validation harness (same for all):

- Walk-forward CV: 24-month train, 12-month test, 1-year slide
- Purged gap between train/test (prevent information leakage)
- Expanding window variant (growing training set)
- Nested CV: inner loop for hyperparameter tuning, outer for evaluation
- Randomized target test (shuffle target → if IC stays high, it's spurious)
- Metrics: OOS IC, quintile spread, calibration MAD, IC hit rate, bootstrap 95% CI

### Phase 3: Ensemble & Optimization

- Stack top 3-5 models from tournament
- Learn stacking weights via nested CV
- Bayesian hyperparameter optimization via Optuna (100-500 trials per model)
- Regime detection: does the optimal model/weights change in different market conditions?

### Phase 4: Calibration & Export

Calibration methods:

- Isotonic regression (monotonic mapping)
- Platt scaling (logistic transformation)
- Quantile mapping (force distribution match)
- Beta calibration (parametric, bounded scores)

Export to production:

- SHAP-based distillation of best nonlinear model → linear weights
- Updated `formula-weights.ts` compatible with existing NestJS scoring engine
- Comparison report: old weights vs new weights on all metrics
- Updated validation report

## 5. Experiment Tracking (MLflow)

Every model run logs:

- **Parameters:** features used, hyperparameters, model type, CV config
- **Metrics:** OOS IC, quintile spread, calibration MAD, IC hit rate, degradation %
- **Artifacts:** weight files, feature importance charts, calibration plots

MLflow runs locally — launch UI with `mlflow ui` to compare experiments in browser.

## 6. Deployment Strategy

**Linear approximation via SHAP:**

- Train best nonlinear model (e.g., XGBoost)
- Compute SHAP values for all training data
- Average SHAP values per feature → linear approximation weights
- These weights drop directly into `formula-weights.ts`
- No new services, no architecture changes

**If linear approximation loses >30% of nonlinear IC:** revisit deployment approach (ONNX export or Python microservice).

## 7. Success Criteria

| Metric                      | Current | Target | Stretch |
| --------------------------- | ------- | ------ | ------- |
| OOS IC (metro HR)           | 0.182   | 0.25   | 0.30    |
| Quintile spread (metro HR)  | 1.53pp  | 3.0pp  | 5.0pp   |
| Calibration MAD             | 17.73pp | 10pp   | 5pp     |
| Beat-state-median rate (Q5) | 58.1%   | 65%    | 70%     |
| Features used               | 3-8     | 20-50  | Optimal |

## 8. Risks

1. **Overfitting with limited windows:** Only 2 non-overlapping 3Y test periods. Mitigation: randomized target tests, strict purged CV, expanding window validation.
2. **Ceiling is low:** Real estate fundamentals may only explain ~20% of return variance (property-specific factors dominate). Mitigation: honest reporting, don't chase impossible accuracy.
3. **Feature engineering noise:** 800 candidates → many will be spurious. Mitigation: stability filtering, multiple selection methods, conservative thresholds.
4. **SHAP distillation loss:** Linear approximation of nonlinear model may lose significant signal. Mitigation: measure IC gap, keep both versions, escalate if >30% loss.
