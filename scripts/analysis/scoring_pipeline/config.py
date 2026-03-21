"""Pipeline configuration: targets, walk-forward params, model defaults, feature exclusions."""

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

TRAINING_DATA_DIR = Path("D:/projects/propertyiq-ml/data/training")
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"

# ---------------------------------------------------------------------------
# Walk-forward CV defaults
# ---------------------------------------------------------------------------

WALK_FORWARD_TRAIN_MONTHS = 24
WALK_FORWARD_TEST_MONTHS = 12
WALK_FORWARD_SLIDE_MONTHS = 12
WALK_FORWARD_START = date(2018, 1, 1)
MIN_TEST_ROWS = 20  # skip window if test set has fewer rows

# ---------------------------------------------------------------------------
# Feature selection
# ---------------------------------------------------------------------------

MAX_FEATURES = 10
COVERAGE_THRESHOLD = 0.50  # drop features with <50% non-null rows
GEO_COVERAGE_THRESHOLD = 0.70  # feature must have data for >=70% of unique geos
CORRELATION_THRESHOLD = 0.95  # for pairs with |r| > this, drop one
MI_TOP_K = 10  # cap at top-K by mutual information

# ---------------------------------------------------------------------------
# Target definitions per score_type × horizon
# ---------------------------------------------------------------------------
# Maps (score_type, horizon) → column name in the parquet.
# If the column doesn't exist for a geo level, that combo is skipped.

TARGET_COLUMNS: dict[tuple[str, str], str] = {
    # HomeReady: excess appreciation vs state
    ("homeready", "1y"): "excess_vs_state_1y",
    ("homeready", "3y"): "excess_vs_state_3y",
    ("homeready", "5y"): "excess_vs_state_5y",
    # InvestorEdge: composite (appreciation + rent excess) or fallback to appreciation
    ("investoredge", "1y"): "__investoredge_composite_1y",
    ("investoredge", "3y"): "__investoredge_composite_3y",
    ("investoredge", "5y"): "excess_vs_state_5y",
    # MarketHealth: raw outcome value (absolute return)
    ("markethealth", "1y"): "outcome_1y_value",
    ("markethealth", "3y"): "outcome_3y_value",
    ("markethealth", "5y"): "outcome_5y_value",
}

# InvestorEdge composite formula components
INVESTOREDGE_COMPOSITE_COMPONENTS = {
    "1y": {
        "appreciation": "excess_vs_state_1y",
        "rent_excess": "rent_return_1y",
    },
    "3y": {
        "appreciation": "excess_vs_state_3y",
        "rent_excess": "rent_return_3y_cagr",
    },
}

# ---------------------------------------------------------------------------
# Outcome / meta columns — excluded from features automatically
# ---------------------------------------------------------------------------

OUTCOME_COLUMNS = [
    "outcome_1y_value",
    "outcome_3y_value",
    "outcome_5y_value",
    "excess_vs_state_1y",
    "excess_vs_state_3y",
    "excess_vs_state_5y",
    "excess_vs_national_1y",
    "excess_vs_national_3y",
    "excess_vs_national_5y",
    "rent_return_1y",
    "rent_return_3y_cagr",
    "state_return_1y",
    "state_return_3y_cagr",
    "state_return_5y_cagr",
    "national_return_1y",
    "national_return_3y_cagr",
    "national_return_5y_cagr",
    "state_rent_return_3y_cagr",
    # National/state rent returns (target-related, leak outcome)
    "national_rent_return_1y",
    "national_rent_return_3y_cagr",
    "state_rent_return_1y",
    # Short-horizon outcome (leaks into 3Y prediction)
    "outcome_6m_value",
    # Computed targets
    "__investoredge_composite_1y",
    "__investoredge_composite_3y",
]

META_COLUMNS = ["_geo_id", "_period"]

# ---------------------------------------------------------------------------
# Leaky feature patterns — raw price levels that leak outcome
# ---------------------------------------------------------------------------
# These contain absolute price information from which appreciation is derived.
# Keeping rate-of-change (yoy, mom) and relative metrics.

LEAKY_FEATURE_PREFIXES = [
    "z_zhvi",           # raw Zillow Home Value Index
    "z_zhvf",           # raw Zillow forecast
    "z_zori",           # raw Zillow rent index
    "z_zordi",          # raw Zillow rent index (detached)
    "z_sale_price",     # raw sale price
    "z_mean_sale_price",
    "z_list_price",
    "z_new_con_median_price",
    "z_new_con_price",
    "median_listing_price",      # absolute price level
    "average_listing_price",     # absolute price level
    "rf_median_sale_price",      # Redfin absolute price
    "rf_median_list_price",      # Redfin absolute list price
    "rf_median_ppsf",            # Redfin price per sqft (absolute)
    "rf_median_list_ppsf",       # Redfin list price per sqft
    "cen_median_home_value",     # Census absolute home value
    "cen_median_gross_rent",     # Census absolute rent
    "cen_median_household_income",  # absolute income (not leaky per se but collinear)
    "cen_per_capita_income",
    "cen_total_population",      # absolute count
    "cen_total_housing_units",
    "cen_owner_occupied_units",
    "cen_renter_occupied_units",
    "cen_total_employment",
    "cen_total_establishments",
    "cen_annual_payroll",
    "econ_gdp_millions",
    "econ_real_gdp_millions",
    "econ_total_nonfarm_employment",
]

# Additional exact-match exclusions (not prefix-based)
LEAKY_FEATURE_EXACT = [
    "household_rank",
    "hotness_rank",
    # Absolute count features — scale with region population, not market quality
    "total_listing_count",
    "active_listing_count",
    "new_listing_count",
    "pending_listing_count",
    "price_increased_count",
    "price_reduced_count",
    "rf_homes_sold",
    "rf_inventory",
    "rf_new_listings",
    "rf_pending_sales",
    "fred_unemployment_claims",
    "fred_housing_starts",
    "fred_building_permits",
]

# ---------------------------------------------------------------------------
# Model hyperparameter defaults (conservative, no HPO in v1)
# ---------------------------------------------------------------------------

XGBOOST_DEFAULTS = {
    "n_estimators": 300,
    "max_depth": 4,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "min_child_weight": 5,
    "reg_alpha": 0.1,
    "reg_lambda": 1.0,
    "random_state": 42,
    "verbosity": 0,
    "n_jobs": -1,
}

LIGHTGBM_DEFAULTS = {
    "n_estimators": 300,
    "max_depth": 4,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "min_child_samples": 20,
    "reg_alpha": 0.1,
    "reg_lambda": 1.0,
    "random_state": 42,
    "verbosity": -1,
    "n_jobs": -1,
}

ELASTICNET_DEFAULTS = {
    "l1_ratio": [0.1, 0.5, 0.7, 0.9, 0.95, 1.0],
    "n_alphas": 50,
    "cv": 5,
    "max_iter": 5000,
    "random_state": 42,
}

# ---------------------------------------------------------------------------
# SHAP
# ---------------------------------------------------------------------------

SHAP_MAX_SAMPLES = 2000  # subsample for SHAP computation on large datasets
SHAP_MIN_WEIGHT = 0.01   # features below this weight are dropped

# ---------------------------------------------------------------------------
# Current production weights (v2.0) for comparison
# ---------------------------------------------------------------------------

CURRENT_PRODUCTION_WEIGHTS = {
    "homeready": {
        "median_days_on_market": {"weight": 0.3096, "direction": -1},
        "affordability_ratio": {"weight": 0.1671, "direction": 1},
        "pending_ratio": {"weight": 0.1484, "direction": 1},
        "supply_score": {"weight": 0.1477, "direction": -1},
        "population_yoy": {"weight": 0.0889, "direction": 1},
        "demand_score": {"weight": 0.0845, "direction": 1},
        "price_reduced_share": {"weight": 0.0374, "direction": -1},
        "unemployment_rate_yoy": {"weight": 0.0164, "direction": -1},
    },
    "investoredge": {
        "median_days_on_market": {"weight": 0.2887, "direction": -1},
        "affordability_ratio": {"weight": 0.177, "direction": 1},
        "pending_ratio": {"weight": 0.1564, "direction": 1},
        "supply_score": {"weight": 0.1287, "direction": -1},
        "population_yoy": {"weight": 0.0837, "direction": 1},
        "demand_score": {"weight": 0.0657, "direction": 1},
        "median_gross_rent": {"weight": 0.0575, "direction": -1},
        "homeownership_rate": {"weight": 0.0423, "direction": 1},
    },
}

# Production OOS ICs for comparison
CURRENT_PRODUCTION_IC = {
    ("metro", "homeready"): 0.18,
    ("metro", "investoredge"): 0.15,
    ("county", "homeready"): 0.16,
    ("county", "investoredge"): 0.13,
    ("zip", "homeready"): 0.12,
    ("zip", "investoredge"): 0.10,
}

# ---------------------------------------------------------------------------
# Valid combos
# ---------------------------------------------------------------------------

ALL_GEO_LEVELS = ["metro", "county", "zip"]
ALL_SCORE_TYPES = ["homeready", "investoredge", "markethealth"]
ALL_HORIZONS = ["1y", "3y", "5y"]

# Default combos to run per score type — all 3 horizons for all 3 scores
DEFAULT_HORIZONS: dict[str, list[str]] = {
    "homeready": ["1y", "3y", "5y"],
    "investoredge": ["1y", "3y", "5y"],
    "markethealth": ["1y", "3y", "5y"],
}
