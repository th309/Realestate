# Scoring Optimizer Python Package — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Python statistics package (`D:\projects\propertyiq-ml`) that finds optimal scoring weights through rigorous feature engineering, model tournament, ensemble optimization, and calibration — improving OOS IC from 0.13-0.18 to 0.25+.

**Architecture:** Standalone Python project at `D:\projects\propertyiq-ml` (separate from the rei-platform monorepo). Direct PostgreSQL connection to Supabase via PgBouncer pooler (same as existing `scripts/analysis/*.py`). Local parquet caching (~800 MB) for fast iteration. MLflow experiment tracking. Jupyter notebooks for exploration.

**Tech Stack:** Python 3.12, pandas, numpy, scipy, scikit-learn, xgboost, lightgbm, torch, optuna, mlflow, psycopg2, sqlalchemy, pyarrow, plotly, fredapi, pytrends, pydantic, click, rich

**Data approach:** Connect to Supabase PostgreSQL via PgBouncer pooler (same credentials as `scripts/analysis/optimize_weights.py`). One-time download of ~17M rows across all tables, cached as parquet in `data/cache/` (~800 MB). Subsequent runs read from local parquet. Total local storage: ~1-1.5 GB.

**Design Doc:** `docs/plans/2026-03-01-scoring-optimizer-python-package-design.md`

---

## Task 1: Scaffold Python Package

**Files:**

- Create: `propertyiq-ml/pyproject.toml`
- Create: `propertyiq-ml/scoring_optimizer/__init__.py`
- Create: `propertyiq-ml/scoring_optimizer/cli.py`
- Create: `propertyiq-ml/scoring_optimizer/config.py`
- Create: `propertyiq-ml/.env.example`
- Create: `propertyiq-ml/.gitignore`

**Step 1: Create pyproject.toml**

```toml
[project]
name = "scoring-optimizer"
version = "0.1.0"
description = "PropertyIQ scoring weight optimization via statistical analysis"
requires-python = ">=3.12"
dependencies = [
    "pandas>=2.2",
    "numpy>=1.26",
    "scipy>=1.12",
    "scikit-learn>=1.4",
    "xgboost>=2.0",
    "lightgbm>=4.3",
    "optuna>=3.5",
    "mlflow>=2.10",
    "psycopg2-binary>=2.9",
    "sqlalchemy>=2.0",
    "pyarrow>=15.0",
    "plotly>=5.18",
    "pydantic>=2.6",
    "pydantic-settings>=2.1",
    "click>=8.1",
    "rich>=13.7",
    "fredapi>=0.5",
    "pytrends>=4.9",
    "shap>=0.44",
    "torch>=2.2",
    "jupyter>=1.0",
    "nbformat>=5.9",
    "ipykernel>=6.29",
    "matplotlib>=3.8",
    "seaborn>=0.13",
]

[project.scripts]
scoring-optimizer = "scoring_optimizer.cli:main"

[build-system]
requires = ["setuptools>=69.0"]
build-backend = "setuptools.backends._legacy:_Backend"
```

**Step 2: Create config.py**

```python
"""Configuration for Supabase connection and project constants."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str  # PostgreSQL via PgBouncer pooler (same as scripts/analysis/*.py)
    fred_api_key: str = ""  # For external macro data (FRED)

    # Walk-forward CV defaults
    train_months: int = 24
    test_months: int = 12
    slide_months: int = 12
    start_date: str = "2020-01-01"

    # Feature engineering
    max_features: int = 50
    stability_cv_threshold: float = 1.0
    min_coef_threshold: float = 0.02
    min_window_fraction: float = 0.50

    # MLflow
    mlflow_tracking_uri: str = "file:./mlruns"
    mlflow_experiment_name: str = "scoring-optimizer"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

**Step 3: Create .env.example**

```
DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
FRED_API_KEY=your-fred-api-key
```

**Step 4: Create CLI entry point**

```python
"""CLI entry point for scoring optimizer."""
import click
from rich.console import Console

console = Console()


@click.group()
def main():
    """PropertyIQ Scoring Optimizer — find optimal weights."""
    pass


@main.command()
def load_data():
    """Phase 0: Load all data from Supabase and cache locally."""
    console.print("[bold green]Loading data from Supabase...[/]")
    from scoring_optimizer.data.loader import DataLoader
    loader = DataLoader()
    loader.load_all()
    console.print("[bold green]Data loaded and cached.[/]")


@main.command()
def engineer_features():
    """Phase 1: Engineer features from raw metrics."""
    console.print("[bold green]Engineering features...[/]")
    from scoring_optimizer.features.engineering import FeatureEngineer
    engineer = FeatureEngineer()
    engineer.run()


@main.command()
def run_tournament():
    """Phase 2: Run model tournament."""
    console.print("[bold green]Running model tournament...[/]")
    from scoring_optimizer.models.tournament import ModelTournament
    tournament = ModelTournament()
    tournament.run()


@main.command()
def optimize():
    """Phase 3: Ensemble optimization."""
    console.print("[bold green]Running ensemble optimization...[/]")
    from scoring_optimizer.optimization.ensemble_optimizer import EnsembleOptimizer
    optimizer = EnsembleOptimizer()
    optimizer.run()


@main.command()
def calibrate():
    """Phase 4: Calibration and export."""
    console.print("[bold green]Running calibration...[/]")
    from scoring_optimizer.models.calibration import CalibrationPipeline
    pipeline = CalibrationPipeline()
    pipeline.run()


@main.command()
def run_all():
    """Run all phases sequentially."""
    from scoring_optimizer.data.loader import DataLoader
    from scoring_optimizer.features.engineering import FeatureEngineer
    from scoring_optimizer.models.tournament import ModelTournament
    from scoring_optimizer.optimization.ensemble_optimizer import EnsembleOptimizer
    from scoring_optimizer.models.calibration import CalibrationPipeline

    for label, runner in [
        ("Loading data", DataLoader()),
        ("Engineering features", FeatureEngineer()),
        ("Model tournament", ModelTournament()),
        ("Ensemble optimization", EnsembleOptimizer()),
        ("Calibration & export", CalibrationPipeline()),
    ]:
        console.print(f"[bold green]{label}...[/]")
        runner.run() if hasattr(runner, 'run') else runner.load_all()


if __name__ == "__main__":
    main()
```

**Step 5: Create .gitignore**

```
__pycache__/
*.pyc
.env
mlruns/
data/cache/
*.egg-info/
dist/
build/
.venv/
```

**Step 6: Create **init**.py**

```python
"""PropertyIQ Scoring Optimizer."""
__version__ = "0.1.0"
```

**Step 7: Create subdirectory **init**.py files**

Create empty `__init__.py` in: `data/`, `features/`, `models/`, `validation/`, `optimization/`, `tracking/`, `reporting/`

**Step 8: Install the package**

Run: `cd D:/projects/propertyiq-ml && pip install -e .`
Expected: Package installs with all dependencies

**Step 9: Verify CLI works**

Run: `cd D:/projects/propertyiq-ml && python -m scoring_optimizer.cli --help`
Expected: Shows help with load-data, engineer-features, run-tournament, optimize, calibrate, run-all commands

**Step 10: Commit**

```bash
git add -A
git commit -m "feat(scoring-optimizer): scaffold Python package with CLI and config"
```

---

## Task 2: Data Loader — Supabase to Parquet

**Files:**

- Create: `propertyiq-ml/scoring_optimizer/data/loader.py`
- Create: `propertyiq-ml/scoring_optimizer/data/cache.py`
- Create: `propertyiq-ml/scoring_optimizer/data/schema.py`
- Create: `propertyiq-ml/tests/test_loader.py`

**Step 1: Create schema.py with table definitions**

```python
"""Table definitions and column mappings for all Supabase tables."""
from dataclasses import dataclass

# Tables to pull and their key columns
TABLES = {
    # Zillow (long format: region_id, metric_name, value, period_date)
    "zillow_metro": {"id_col": "cbsa_code", "date_col": "period_date", "format": "long"},
    "zillow_county": {"id_col": "fips_code", "date_col": "period_date", "format": "long"},
    "zillow_zip": {"id_col": "region_name", "date_col": "period_date", "format": "long"},
    "zillow_state": {"id_col": "state_code", "date_col": "period_date", "format": "long"},

    # Realtor (wide format: one column per metric)
    "realtor_metro": {"id_col": "cbsa_code", "date_col": "period_date", "format": "wide"},
    "realtor_county": {"id_col": "county_fips", "date_col": "period_date", "format": "wide"},
    "realtor_zip": {"id_col": "postal_code", "date_col": "period_date", "format": "wide"},
    "realtor_state": {"id_col": "state_id", "date_col": "period_date", "format": "wide"},

    # Redfin (wide format with property_type filter)
    "redfin_metro": {"id_col": "cbsa_code", "date_col": "period_end", "format": "wide", "filter": {"property_type": "All Residential"}},
    "redfin_county": {"id_col": "fips_code", "date_col": "period_end", "format": "wide", "filter": {"property_type": "All Residential"}},
    "redfin_zip": {"id_col": "zip_code", "date_col": "period_end", "format": "wide", "filter": {"property_type": "All Residential"}},

    # Census (wide, annual)
    "census_metro": {"id_col": "cbsa_code", "date_col": "year", "format": "wide"},
    "census_county": {"id_col": "fips_code", "date_col": "year", "format": "wide"},
    "census_zip": {"id_col": "zcta", "date_col": "year", "format": "wide"},
    "census_state": {"id_col": "state_fips", "date_col": "year", "format": "wide"},

    # Economic
    "economic_metro": {"id_col": "cbsa_code", "date_col": "period_date", "format": "wide"},
    "economic_county": {"id_col": "fips_code", "date_col": "period_date", "format": "wide"},
    "economic_state": {"id_col": "state_fips", "date_col": "period_date", "format": "wide"},

    # Permits
    "permits_metro": {"id_col": "cbsa_code", "date_col": "period_date", "format": "wide"},
    "permits_county": {"id_col": "fips_code", "date_col": "period_date", "format": "wide"},

    # Calculated metrics
    "calculated_metrics": {"id_col": "geography_id", "date_col": "period_date", "format": "wide"},

    # Scoring & Outcomes
    "propertyiq_scores": {"id_col": "location_id", "date_col": "score_date", "format": "wide"},
    "propertyiq_backtest_outcomes": {"id_col": "geography_id", "date_col": "score_date", "format": "wide"},

    # Geography crosswalk
    "geography_crosswalk": {"id_col": "zip_code", "date_col": None, "format": "wide"},
}

GEO_LEVELS = ["metro", "county", "zip"]
SCORE_TYPES = ["homeready", "investoredge"]
```

**Step 2: Create cache.py**

```python
"""Local parquet caching for Supabase data."""
import os
from pathlib import Path
from datetime import datetime, timedelta

import pandas as pd

CACHE_DIR = Path(__file__).parent.parent.parent / "data" / "cache"


def get_cache_path(table_name: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR / f"{table_name}.parquet"


def is_cache_fresh(table_name: str, max_age_hours: int = 24) -> bool:
    path = get_cache_path(table_name)
    if not path.exists():
        return False
    mtime = datetime.fromtimestamp(path.stat().st_mtime)
    return datetime.now() - mtime < timedelta(hours=max_age_hours)


def save_to_cache(df: pd.DataFrame, table_name: str) -> None:
    path = get_cache_path(table_name)
    df.to_parquet(path, index=False)


def load_from_cache(table_name: str) -> pd.DataFrame | None:
    path = get_cache_path(table_name)
    if path.exists():
        return pd.read_parquet(path)
    return None
```

**Step 3: Create loader.py**

```python
"""Load all data from Supabase PostgreSQL via PgBouncer pooler with local parquet caching."""
import pandas as pd
from rich.console import Console
from rich.progress import track
from sqlalchemy import create_engine, text

from scoring_optimizer.config import settings
from scoring_optimizer.data.cache import is_cache_fresh, save_to_cache, load_from_cache
from scoring_optimizer.data.schema import TABLES

console = Console()


class DataLoader:
    def __init__(self):
        self.engine = create_engine(
            settings.database_url,
            connect_args={"options": "-c statement_timeout=300000"},  # 5 min timeout
        )
        self.data: dict[str, pd.DataFrame] = {}

    def _fetch_table(self, table_name: str, table_config: dict) -> pd.DataFrame:
        """Fetch entire table via SQL."""
        where_clauses = []
        if "filter" in table_config:
            for col, val in table_config["filter"].items():
                where_clauses.append(f"{col} = '{val}'")
        where = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        query = f"SELECT * FROM {table_name}{where}"
        return pd.read_sql(query, self.engine)

    def load_table(self, table_name: str, force_refresh: bool = False) -> pd.DataFrame:
        """Load a single table (from parquet cache or PostgreSQL)."""
        if not force_refresh and is_cache_fresh(table_name):
            df = load_from_cache(table_name)
            if df is not None:
                console.print(f"  [dim]{table_name}: {len(df):,} rows (cached)[/]")
                self.data[table_name] = df
                return df

        config = TABLES.get(table_name, {})
        df = self._fetch_table(table_name, config)
        save_to_cache(df, table_name)
        console.print(f"  [green]{table_name}: {len(df):,} rows (fetched from DB)[/]")
        self.data[table_name] = df
        return df

    def load_all(self, force_refresh: bool = False) -> dict[str, pd.DataFrame]:
        """Load all tables defined in schema."""
        console.print(f"[bold]Loading {len(TABLES)} tables from Supabase PostgreSQL...[/]")
        for table_name in track(TABLES.keys(), description="Loading tables"):
            try:
                self.load_table(table_name, force_refresh)
            except Exception as e:
                console.print(f"  [red]{table_name}: FAILED — {e}[/]")
        console.print(f"[bold green]Loaded {len(self.data)} tables successfully.[/]")
        return self.data

    def get_outcomes(self) -> pd.DataFrame:
        """Get backtest outcomes, loading if needed."""
        if "propertyiq_backtest_outcomes" not in self.data:
            self.load_table("propertyiq_backtest_outcomes")
        return self.data["propertyiq_backtest_outcomes"]

    def get_scores(self) -> pd.DataFrame:
        """Get existing scores, loading if needed."""
        if "propertyiq_scores" not in self.data:
            self.load_table("propertyiq_scores")
        return self.data["propertyiq_scores"]

    def get_crosswalk(self) -> pd.DataFrame:
        """Get geography crosswalk, loading if needed."""
        if "geography_crosswalk" not in self.data:
            self.load_table("geography_crosswalk")
        return self.data["geography_crosswalk"]
```

**Step 4: Write test**

```python
"""Test data loader basics."""
from scoring_optimizer.data.schema import TABLES, GEO_LEVELS
from scoring_optimizer.data.cache import get_cache_path, CACHE_DIR


def test_tables_defined():
    assert len(TABLES) > 20
    assert "propertyiq_backtest_outcomes" in TABLES
    assert "geography_crosswalk" in TABLES


def test_geo_levels():
    assert GEO_LEVELS == ["metro", "county", "zip"]


def test_cache_path():
    path = get_cache_path("test_table")
    assert path.name == "test_table.parquet"
    assert "cache" in str(path)
```

**Step 5: Run tests**

Run: `cd D:/projects/propertyiq-ml && python -m pytest tests/ -v`
Expected: All tests pass

**Step 6: Test actual data loading**

Run: `cd D:/projects/propertyiq-ml && python -c "from scoring_optimizer.data.loader import DataLoader; dl = DataLoader(); dl.load_table('propertyiq_backtest_outcomes'); print(f'Loaded {len(dl.data[\"propertyiq_backtest_outcomes\"]):,} rows')"`
Expected: Prints row count (should be ~600K+ rows)

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(scoring-optimizer): add data loader with Supabase connection and parquet caching"
```

---

## Task 3: Validation Harness

**Files:**

- Create: `propertyiq-ml/scoring_optimizer/validation/walk_forward.py`
- Create: `propertyiq-ml/scoring_optimizer/validation/metrics.py`
- Create: `propertyiq-ml/scoring_optimizer/validation/bootstrap.py`
- Create: `propertyiq-ml/tests/test_validation.py`

**Step 1: Create metrics.py — scoring metrics (IC, quintile spread, MAD, hit rate)**

```python
"""Validation metrics for scoring models."""
import numpy as np
import pandas as pd
from scipy import stats


def information_coefficient(scores: np.ndarray, outcomes: np.ndarray) -> float:
    """Spearman rank correlation between scores and outcomes."""
    mask = ~(np.isnan(scores) | np.isnan(outcomes))
    if mask.sum() < 20:
        return np.nan
    corr, _ = stats.spearmanr(scores[mask], outcomes[mask])
    return float(corr)


def quintile_spread(scores: np.ndarray, outcomes: np.ndarray, n_quantiles: int = 5) -> float:
    """Average outcome of top quintile minus bottom quintile."""
    mask = ~(np.isnan(scores) | np.isnan(outcomes))
    s, o = scores[mask], outcomes[mask]
    if len(s) < n_quantiles * 10:
        return np.nan
    quintile_labels = pd.qcut(s, n_quantiles, labels=False, duplicates="drop")
    top = o[quintile_labels == quintile_labels.max()].mean()
    bottom = o[quintile_labels == quintile_labels.min()].mean()
    return float(top - bottom)


def quintile_table(scores: np.ndarray, outcomes: np.ndarray) -> pd.DataFrame:
    """Full quintile breakdown table."""
    mask = ~(np.isnan(scores) | np.isnan(outcomes))
    df = pd.DataFrame({"score": scores[mask], "outcome": outcomes[mask]})
    df["quintile"] = pd.qcut(df["score"], 5, labels=["Q1", "Q2", "Q3", "Q4", "Q5"], duplicates="drop")
    return df.groupby("quintile", observed=True).agg(
        avg_score=("score", "mean"),
        avg_outcome=("outcome", "mean"),
        count=("outcome", "count"),
        beat_median_rate=("outcome", lambda x: (x > 0).mean() * 100),
    ).reset_index()


def decile_spread(scores: np.ndarray, outcomes: np.ndarray) -> float:
    """Top decile minus bottom decile average outcome."""
    return quintile_spread(scores, outcomes, n_quantiles=10)


def calibration_mad(scores: np.ndarray, outcomes: np.ndarray, n_deciles: int = 10) -> float:
    """Mean absolute deviation between predicted and actual percentiles."""
    mask = ~(np.isnan(scores) | np.isnan(outcomes))
    s, o = scores[mask], outcomes[mask]
    if len(s) < n_deciles * 10:
        return np.nan
    score_deciles = pd.qcut(s, n_deciles, labels=False, duplicates="drop")
    deviations = []
    for d in range(n_deciles):
        predicted_pct = (d + 0.5) / n_deciles * 100
        actual_outcomes = o[score_deciles == d]
        actual_pct = stats.percentileofscore(o, actual_outcomes.mean())
        deviations.append(abs(predicted_pct - actual_pct))
    return float(np.mean(deviations))


def ic_hit_rate(per_period_ics: list[float]) -> float:
    """Percentage of periods where IC > 0."""
    valid = [ic for ic in per_period_ics if not np.isnan(ic)]
    if not valid:
        return 0.0
    return sum(1 for ic in valid if ic > 0) / len(valid) * 100


def ic_information_ratio(per_period_ics: list[float]) -> float:
    """Mean IC / Std IC — consistency of signal."""
    valid = [ic for ic in per_period_ics if not np.isnan(ic)]
    if len(valid) < 2:
        return 0.0
    mean_ic = np.mean(valid)
    std_ic = np.std(valid, ddof=1)
    return float(mean_ic / std_ic) if std_ic > 0 else 0.0


def full_evaluation(scores: np.ndarray, outcomes: np.ndarray) -> dict:
    """Run all metrics and return a summary dict."""
    return {
        "ic": information_coefficient(scores, outcomes),
        "quintile_spread": quintile_spread(scores, outcomes),
        "decile_spread": decile_spread(scores, outcomes),
        "calibration_mad": calibration_mad(scores, outcomes),
        "n": int((~(np.isnan(scores) | np.isnan(outcomes))).sum()),
    }
```

**Step 2: Create walk_forward.py**

```python
"""Walk-forward cross-validation harness."""
from dataclasses import dataclass
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta

import numpy as np
import pandas as pd
from rich.console import Console

from scoring_optimizer.validation.metrics import full_evaluation

console = Console()


@dataclass
class WalkForwardWindow:
    train_start: date
    train_end: date
    test_start: date
    test_end: date


@dataclass
class WalkForwardResult:
    window: WalkForwardWindow
    train_metrics: dict
    test_metrics: dict
    model_params: dict | None = None


def generate_windows(
    start_date: date,
    end_date: date,
    train_months: int = 24,
    test_months: int = 12,
    slide_months: int = 12,
    purge_months: int = 0,
) -> list[WalkForwardWindow]:
    """Generate walk-forward windows with optional purge gap."""
    windows = []
    current = start_date
    while True:
        train_end = current + relativedelta(months=train_months) - timedelta(days=1)
        purge_end = train_end + relativedelta(months=purge_months)
        test_start = purge_end + timedelta(days=1)
        test_end = test_start + relativedelta(months=test_months) - timedelta(days=1)
        if test_end > end_date:
            break
        windows.append(WalkForwardWindow(
            train_start=current,
            train_end=train_end,
            test_start=test_start,
            test_end=test_end,
        ))
        current += relativedelta(months=slide_months)
    return windows


class WalkForwardCV:
    """Walk-forward cross-validation evaluator."""

    def __init__(
        self,
        train_months: int = 24,
        test_months: int = 12,
        slide_months: int = 12,
        purge_months: int = 0,
        min_test_obs: int = 20,
    ):
        self.train_months = train_months
        self.test_months = test_months
        self.slide_months = slide_months
        self.purge_months = purge_months
        self.min_test_obs = min_test_obs

    def evaluate(
        self,
        model,
        features: pd.DataFrame,
        target: pd.Series,
        dates: pd.Series,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[WalkForwardResult]:
        """Run walk-forward CV on a model. Model must have fit(X, y) and predict(X)."""
        if start_date is None:
            start_date = dates.min().date() if hasattr(dates.min(), 'date') else dates.min()
        if end_date is None:
            end_date = dates.max().date() if hasattr(dates.max(), 'date') else dates.max()

        windows = generate_windows(
            start_date, end_date,
            self.train_months, self.test_months,
            self.slide_months, self.purge_months,
        )

        results = []
        for window in windows:
            train_mask = (dates >= str(window.train_start)) & (dates <= str(window.train_end))
            test_mask = (dates >= str(window.test_start)) & (dates <= str(window.test_end))

            X_train = features[train_mask].dropna(axis=1, how="all")
            y_train = target[train_mask]
            X_test = features[test_mask][X_train.columns]
            y_test = target[test_mask]

            # Drop rows with NaN target
            train_valid = ~y_train.isna()
            test_valid = ~y_test.isna()
            X_train, y_train = X_train[train_valid], y_train[train_valid]
            X_test, y_test = X_test[test_valid], y_test[test_valid]

            if len(y_test) < self.min_test_obs:
                continue

            # Fill remaining NaN features with column median
            X_train = X_train.fillna(X_train.median())
            X_test = X_test.fillna(X_train.median())

            model.fit(X_train, y_train)
            train_preds = model.predict(X_train)
            test_preds = model.predict(X_test)

            results.append(WalkForwardResult(
                window=window,
                train_metrics=full_evaluation(train_preds, y_train.values),
                test_metrics=full_evaluation(test_preds, y_test.values),
                model_params=model.get_params() if hasattr(model, "get_params") else None,
            ))

        return results

    def summarize(self, results: list[WalkForwardResult]) -> dict:
        """Aggregate walk-forward results."""
        if not results:
            return {"n_windows": 0}
        test_ics = [r.test_metrics["ic"] for r in results]
        test_spreads = [r.test_metrics["quintile_spread"] for r in results]
        train_ics = [r.train_metrics["ic"] for r in results]
        return {
            "n_windows": len(results),
            "oos_ic_mean": float(np.nanmean(test_ics)),
            "oos_ic_std": float(np.nanstd(test_ics)),
            "oos_quintile_spread_mean": float(np.nanmean(test_spreads)),
            "is_ic_mean": float(np.nanmean(train_ics)),
            "ic_degradation": 1 - float(np.nanmean(test_ics)) / float(np.nanmean(train_ics)) if np.nanmean(train_ics) != 0 else 0,
            "total_test_obs": sum(r.test_metrics["n"] for r in results),
        }
```

**Step 3: Create bootstrap.py**

```python
"""Bootstrap significance testing."""
import numpy as np
from scoring_optimizer.validation.metrics import quintile_spread


def bootstrap_quintile_spread(
    scores: np.ndarray,
    outcomes: np.ndarray,
    n_iterations: int = 1000,
    ci: float = 0.95,
    seed: int = 42,
) -> dict:
    """Bootstrap test for quintile spread significance."""
    rng = np.random.default_rng(seed)
    mask = ~(np.isnan(scores) | np.isnan(outcomes))
    s, o = scores[mask], outcomes[mask]
    n = len(s)

    observed = quintile_spread(s, o)
    boot_spreads = []
    for _ in range(n_iterations):
        idx = rng.integers(0, n, size=n)
        spread = quintile_spread(s[idx], o[idx])
        if not np.isnan(spread):
            boot_spreads.append(spread)

    boot_spreads = np.array(boot_spreads)
    alpha = 1 - ci
    return {
        "observed": float(observed),
        "mean": float(np.mean(boot_spreads)),
        "ci_lower": float(np.percentile(boot_spreads, alpha / 2 * 100)),
        "ci_upper": float(np.percentile(boot_spreads, (1 - alpha / 2) * 100)),
        "significant": float(np.percentile(boot_spreads, alpha / 2 * 100)) > 0,
        "n_samples": n,
        "n_iterations": len(boot_spreads),
    }


def randomized_target_test(
    model,
    features: np.ndarray,
    target: np.ndarray,
    n_iterations: int = 100,
    seed: int = 42,
) -> dict:
    """Shuffle target and re-fit — if IC stays high, signal is spurious."""
    from scoring_optimizer.validation.metrics import information_coefficient
    rng = np.random.default_rng(seed)

    # Real IC
    model.fit(features, target)
    real_preds = model.predict(features)
    real_ic = information_coefficient(real_preds, target)

    # Shuffled ICs
    shuffled_ics = []
    for _ in range(n_iterations):
        shuffled_target = rng.permutation(target)
        model.fit(features, shuffled_target)
        preds = model.predict(features)
        shuffled_ics.append(information_coefficient(preds, shuffled_target))

    shuffled_ics = np.array(shuffled_ics)
    p_value = (shuffled_ics >= real_ic).mean()
    return {
        "real_ic": float(real_ic),
        "shuffled_ic_mean": float(np.mean(shuffled_ics)),
        "shuffled_ic_std": float(np.std(shuffled_ics)),
        "p_value": float(p_value),
        "significant": p_value < 0.05,
    }
```

**Step 4: Write tests**

```python
"""Test validation metrics and walk-forward CV."""
import numpy as np
from scoring_optimizer.validation.metrics import (
    information_coefficient, quintile_spread, calibration_mad,
    ic_hit_rate, full_evaluation,
)


def test_ic_perfect_correlation():
    scores = np.arange(100, dtype=float)
    outcomes = np.arange(100, dtype=float)
    ic = information_coefficient(scores, outcomes)
    assert ic > 0.99


def test_ic_random():
    rng = np.random.default_rng(42)
    scores = rng.random(1000)
    outcomes = rng.random(1000)
    ic = information_coefficient(scores, outcomes)
    assert abs(ic) < 0.1  # Should be near zero


def test_quintile_spread_positive():
    scores = np.arange(1000, dtype=float)
    outcomes = scores + np.random.default_rng(42).normal(0, 10, 1000)
    spread = quintile_spread(scores, outcomes)
    assert spread > 0  # Higher scores = higher outcomes


def test_full_evaluation():
    scores = np.arange(200, dtype=float)
    outcomes = scores * 0.5 + np.random.default_rng(42).normal(0, 5, 200)
    result = full_evaluation(scores, outcomes)
    assert "ic" in result
    assert "quintile_spread" in result
    assert "calibration_mad" in result
    assert result["n"] == 200
```

**Step 5: Run tests**

Run: `cd D:/projects/propertyiq-ml && python -m pytest tests/ -v`

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(scoring-optimizer): add validation harness with walk-forward CV, metrics, and bootstrap"
```

---

## Task 4: Feature Engineering Pipeline

**Files:**

- Create: `propertyiq-ml/scoring_optimizer/features/registry.py`
- Create: `propertyiq-ml/scoring_optimizer/features/engineering.py`
- Create: `propertyiq-ml/scoring_optimizer/features/selection.py`

**Step 1: Create registry.py — define all feature categories**

Define the ~800 candidate features: raw metrics, YoY changes, momentum, cross-sectional ranks, interactions, lag structures, rolling stats, regime indicators, relative value features. Each entry specifies: name, source_table, source_column, transform_type, parameters.

**Step 2: Create engineering.py — feature creation pipeline**

The `FeatureEngineer` class:

1. Loads cached data from parquet (or triggers DataLoader)
2. For each geography level (metro, county, zip):
   a. Pivots long-format tables (Zillow) to wide
   b. Merges all source tables on (region_id, date)
   c. Computes derived features: YoY deltas, momentum (3M/6M rolling), cross-sectional percentile rank within state, interaction terms (affordability × pop_growth, etc.), lag features (6M/12M/24M lookbacks), rolling mean/std
   d. Adds macro/regime features (national-level: mortgage rates, S&P, VIX)
3. Joins with backtest outcomes to create the final feature matrix
4. Saves feature matrix as parquet: `output/features_{geo}.parquet`

**Step 3: Create selection.py — feature selection pipeline**

The `FeatureSelector` class:

1. Removes features with >50% missing
2. Computes mutual information with target
3. Clusters correlated features (threshold 0.85), keeps best per cluster
4. Runs permutation importance via random forest
5. Stability filter across walk-forward windows
6. Returns ranked feature list with importance scores

**Step 4: Test feature engineering on metro data**

Run: `cd D:/projects/propertyiq-ml && python -c "from scoring_optimizer.features.engineering import FeatureEngineer; fe = FeatureEngineer(); fe.run(geo_levels=['metro']); print(f'Metro features: {fe.feature_matrix[\"metro\"].shape}')"`
Expected: Prints shape like (23859, 200+) — many rows, many feature columns

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(scoring-optimizer): add feature engineering pipeline with ~800 candidate features"
```

---

## Task 5: MLflow Experiment Tracking

**Files:**

- Create: `propertyiq-ml/scoring_optimizer/tracking/experiment.py`
- Create: `propertyiq-ml/scoring_optimizer/tracking/compare.py`

**Step 1: Create experiment.py**

```python
"""MLflow experiment tracking integration."""
import mlflow
from scoring_optimizer.config import settings


def init_tracking():
    """Initialize MLflow tracking."""
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    mlflow.set_experiment(settings.mlflow_experiment_name)


def log_model_run(
    model_name: str,
    geo_level: str,
    score_type: str,
    params: dict,
    metrics: dict,
    artifacts: dict[str, str] | None = None,
    tags: dict[str, str] | None = None,
):
    """Log a single model training run to MLflow."""
    init_tracking()
    with mlflow.start_run(run_name=f"{model_name}_{geo_level}_{score_type}"):
        mlflow.set_tags({
            "model": model_name,
            "geo_level": geo_level,
            "score_type": score_type,
            **(tags or {}),
        })
        mlflow.log_params(params)
        mlflow.log_metrics(metrics)
        if artifacts:
            for name, path in artifacts.items():
                mlflow.log_artifact(path, name)
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(scoring-optimizer): add MLflow experiment tracking"
```

---

## Task 6: Model Tournament

**Files:**

- Create: `propertyiq-ml/scoring_optimizer/models/base.py`
- Create: `propertyiq-ml/scoring_optimizer/models/linear.py`
- Create: `propertyiq-ml/scoring_optimizer/models/tree.py`
- Create: `propertyiq-ml/scoring_optimizer/models/neural.py`
- Create: `propertyiq-ml/scoring_optimizer/models/tournament.py`

**Step 1: Create base.py — abstract model interface**

```python
"""Base model interface for tournament."""
from abc import ABC, abstractmethod
import numpy as np


class ScoringModel(ABC):
    """All tournament models must implement this interface."""

    @abstractmethod
    def fit(self, X: np.ndarray, y: np.ndarray) -> None: ...

    @abstractmethod
    def predict(self, X: np.ndarray) -> np.ndarray: ...

    @abstractmethod
    def get_params(self) -> dict: ...

    @abstractmethod
    def get_feature_importance(self) -> dict[str, float] | None: ...

    @property
    @abstractmethod
    def name(self) -> str: ...
```

**Step 2: Create linear.py — elastic net, ridge, lasso, PCA+ridge**

Wrap scikit-learn models with the `ScoringModel` interface. Include StandardScaler preprocessing.

**Step 3: Create tree.py — XGBoost, LightGBM, random forest**

Wrap tree-based models with `ScoringModel` interface. Default hyperparameters tuned for tabular financial data (low learning rate, regularization, early stopping).

**Step 4: Create neural.py — MLP and TabNet**

PyTorch MLP with configurable layers. TabNet wrapper if available, fallback to MLP.

**Step 5: Create tournament.py — orchestrator**

The `ModelTournament` class:

1. Loads feature matrices from parquet
2. For each (geo_level, score_type):
   a. Instantiates all 10 model types
   b. Runs walk-forward CV on each
   c. Logs results to MLflow
   d. Ranks models by OOS IC
   e. Runs randomized target test on top 3
3. Saves tournament results to `output/tournament_results.json`
4. Prints leaderboard with Rich tables

**Step 6: Test tournament on metro HomeReady**

Run: `cd D:/projects/propertyiq-ml && python -m scoring_optimizer.cli run-tournament`
Expected: Leaderboard printed, MLflow runs created

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(scoring-optimizer): add model tournament with 10 model types"
```

---

## Task 7: Ensemble & Bayesian Optimization

**Files:**

- Create: `propertyiq-ml/scoring_optimizer/models/ensemble.py`
- Create: `propertyiq-ml/scoring_optimizer/optimization/bayesian.py`
- Create: `propertyiq-ml/scoring_optimizer/optimization/ensemble_optimizer.py`
- Create: `propertyiq-ml/scoring_optimizer/optimization/regime.py`

**Step 1: Create ensemble.py — stacking meta-learner**

Stack top N models from tournament. Meta-learner uses ridge regression on OOS predictions. Includes simple average and learned weights variants.

**Step 2: Create bayesian.py — Optuna hyperparameter search**

Wrap Optuna for hyperparameter optimization. Define search spaces for each model type. Objective function: OOS IC from walk-forward CV. 100-500 trials per model.

**Step 3: Create ensemble_optimizer.py — orchestrator**

The `EnsembleOptimizer` class:

1. Loads tournament results
2. Takes top 5 models
3. Runs Optuna optimization on each
4. Builds stacked ensemble
5. Evaluates ensemble vs individual models
6. Logs to MLflow

**Step 4: Create regime.py — market regime detection**

Detect bull/bear/sideways regimes using national ZHVI appreciation rate. Test whether different model weights work better in different regimes. Features: rolling 12M national appreciation, VIX level, mortgage rate trend.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(scoring-optimizer): add ensemble stacking and Bayesian hyperparameter optimization"
```

---

## Task 8: Calibration & Export

**Files:**

- Create: `propertyiq-ml/scoring_optimizer/models/calibration.py`
- Create: `propertyiq-ml/scoring_optimizer/reporting/export.py`
- Create: `propertyiq-ml/scoring_optimizer/reporting/comparison.py`

**Step 1: Create calibration.py**

`CalibrationPipeline` class:

1. Takes best model predictions
2. Applies isotonic regression, Platt scaling, quantile mapping, beta calibration
3. Evaluates calibration MAD for each method
4. Selects best calibration method per (geo_level, score_type)
5. Saves calibration lookup tables

**Step 2: Create export.py — SHAP distillation and TypeScript export**

1. Compute SHAP values for best model (tree-based or neural)
2. Average absolute SHAP per feature → linear approximation weights
3. Determine direction (sign of mean SHAP)
4. Normalize weights to sum to 1.0
5. Write `formula-weights-v3.ts` in the same format as existing `formula-weights.ts`
6. Include comparison metrics (old IC vs new IC)

**Step 3: Create comparison.py — old vs new report**

Generate side-by-side comparison:

- Feature list changes
- Weight changes
- OOS IC improvement
- Quintile spread improvement
- Calibration MAD improvement
- Per-geography, per-score-type breakdown

**Step 4: Test full pipeline**

Run: `cd D:/projects/propertyiq-ml && python -m scoring_optimizer.cli run-all`
Expected: All phases complete, output/ contains tournament results, calibration tables, and exported TypeScript weights

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(scoring-optimizer): add calibration pipeline and TypeScript weight export"
```

---

## Task 9: Jupyter Notebooks

**Files:**

- Create: `propertyiq-ml/notebooks/01_data_exploration.ipynb`
- Create: `propertyiq-ml/notebooks/02_feature_engineering.ipynb`
- Create: `propertyiq-ml/notebooks/03_model_tournament.ipynb`
- Create: `propertyiq-ml/notebooks/04_ensemble_optimization.ipynb`
- Create: `propertyiq-ml/notebooks/05_final_report.ipynb`

**Step 1: Create notebook 01 — Data Exploration**

Cells: load data, show table sizes, plot time coverage per metric per geography, show distribution of outcomes (excess returns), correlation heatmap of raw metrics, missing data analysis.

**Step 2: Create notebook 02 — Feature Engineering**

Cells: load feature matrix, show feature counts by category, feature correlation analysis, mutual information with target, top features by importance, stability across time.

**Step 3: Create notebook 03 — Model Tournament**

Cells: load tournament results, leaderboard table, bar charts of OOS IC by model, scatter plots of IS vs OOS IC (overfitting detection), per-window results, feature importance comparison across models.

**Step 4: Create notebook 04 — Ensemble Optimization**

Cells: ensemble weights, ensemble vs individual model comparison, Optuna hyperparameter distributions, regime analysis results.

**Step 5: Create notebook 05 — Final Report**

Cells: old vs new comparison tables, calibration plots (predicted vs actual percentile), quintile tables for best model, SHAP summary plots, exported weight summary, recommendations.

**Step 6: Commit**

```bash
git add -Anotebooks/
git commit -m "feat(scoring-optimizer): add Jupyter notebooks for interactive exploration"
```

---

## Task 10: External Data Sources

**Files:**

- Create: `propertyiq-ml/scoring_optimizer/data/external.py`

**Step 1: Create external.py**

```python
"""External data sources: FRED, Google Trends, S&P."""
import pandas as pd
from fredapi import Fred
from pytrends.request import TrendReq

from scoring_optimizer.config import settings
from scoring_optimizer.data.cache import save_to_cache, load_from_cache, is_cache_fresh


class ExternalDataLoader:
    """Load macro/regime indicators from external APIs."""

    def load_fred_series(self, series_ids: dict[str, str]) -> pd.DataFrame:
        """Load FRED economic series.

        series_ids: mapping of friendly_name -> FRED series ID
        Example: {"mortgage_30y": "MORTGAGE30US", "treasury_10y": "DGS10"}
        """
        if is_cache_fresh("fred_macro"):
            cached = load_from_cache("fred_macro")
            if cached is not None:
                return cached

        fred = Fred(api_key=settings.fred_api_key)
        frames = {}
        for name, series_id in series_ids.items():
            try:
                data = fred.get_series(series_id)
                frames[name] = data
            except Exception:
                continue

        df = pd.DataFrame(frames)
        df.index.name = "date"
        df = df.reset_index()
        save_to_cache(df, "fred_macro")
        return df

    def load_google_trends(self, keywords: list[str], timeframe: str = "2019-01-01 2026-01-01") -> pd.DataFrame:
        """Load Google Trends data for housing-related keywords."""
        if is_cache_fresh("google_trends"):
            cached = load_from_cache("google_trends")
            if cached is not None:
                return cached

        pytrends = TrendReq()
        pytrends.build_payload(keywords[:5], timeframe=timeframe)
        df = pytrends.interest_over_time()
        save_to_cache(df.reset_index(), "google_trends")
        return df


# Default FRED series for regime features
FRED_MACRO_SERIES = {
    "mortgage_30y": "MORTGAGE30US",
    "treasury_10y": "DGS10",
    "unemployment_claims": "ICSA",
    "cpi_all": "CPIAUCSL",
    "housing_starts": "HOUST",
    "consumer_sentiment": "UMCSENT",
    "sp500": "SP500",
    "vix": "VIXCLS",
}

GOOGLE_TRENDS_KEYWORDS = [
    "buy a house",
    "home prices",
    "mortgage rates",
    "housing market crash",
    "real estate investing",
]
```

**Step 2: FRED API key is already in config**

The `fred_api_key` field and `.env.example` entry were added in Task 1. User needs a free FRED API key from https://fred.stlouisfed.org/docs/api/api_key.html

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(scoring-optimizer): add external data sources (FRED, Google Trends)"
```

---

## Execution Order Summary

| Task | Phase       | Description                                           | Depends On |
| ---- | ----------- | ----------------------------------------------------- | ---------- |
| 1    | Setup       | Scaffold package, CLI, config                         | —          |
| 2    | Setup       | Data loader (Supabase → parquet)                      | 1          |
| 3    | Setup       | Validation harness (metrics, walk-forward, bootstrap) | 1          |
| 5    | Setup       | MLflow tracking                                       | 1          |
| 10   | Setup       | External data sources (FRED, Google Trends)           | 2          |
| 4    | Phase 1     | Feature engineering pipeline                          | 2, 10      |
| 6    | Phase 2     | Model tournament (10 models)                          | 3, 4, 5    |
| 7    | Phase 3     | Ensemble + Bayesian optimization                      | 6          |
| 8    | Phase 4     | Calibration + TypeScript export                       | 7          |
| 9    | Exploration | Jupyter notebooks                                     | 2-8        |

**Parallel opportunities:**

- Tasks 2, 3, 5 can be built in parallel (no dependencies on each other)
- Task 10 can parallel with Task 3
- Notebooks (Task 9) can be built incrementally alongside each phase
