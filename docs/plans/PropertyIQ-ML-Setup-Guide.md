# PropertyIQ ML Tools Setup Guide

## Overview

This guide will help you connect ML/analytics tools to your PostgreSQL database to optimize your scoring formulas. No prior ML experience required.

**What you'll be able to do after this setup:**
1. Pull 20M records from your database in seconds
2. Discover which metrics actually predict good outcomes
3. Find the optimal weights for your formula components
4. Track different formula versions and compare them
5. Generate reports showing why scores are what they are

---

## Part 1: Environment Setup

### 1.1 Prerequisites

You need:
- Python 3.10 or 3.11 installed
- Access to your PostgreSQL database (connection string)
- About 16GB RAM recommended (8GB minimum)
- 10GB free disk space

### 1.2 Create Project Directory

```bash
# Create a new directory for ML work
mkdir propertyiq-ml
cd propertyiq-ml

# Create subdirectories
mkdir -p data models notebooks reports scripts
```

### 1.3 Create Python Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate it
# On Mac/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate

# You should see (venv) in your terminal prompt
```

### 1.4 Install Required Packages

```bash
# Create requirements.txt
cat > requirements.txt << 'EOF'
# Database connectivity
psycopg2-binary==2.9.9
sqlalchemy==2.0.25

# Fast data processing
polars==0.20.5
pyarrow==15.0.0
duckdb==0.9.2

# Machine Learning
autogluon==1.1.0
scikit-learn==1.4.0
scipy==1.12.0

# Feature engineering
featuretools==1.28.0
tsfresh==0.20.2

# Explainability
shap==0.44.1

# Experiment tracking
mlflow==2.10.0

# Visualization
plotly==5.18.0
matplotlib==3.8.2
seaborn==0.13.1

# Utilities
pandas==2.2.0
numpy==1.26.3
python-dotenv==1.0.0
tqdm==4.66.1
jupyter==1.0.0
EOF

# Install everything (this takes 10-15 minutes)
pip install -r requirements.txt
```

### 1.5 Create Environment File

Store your database credentials securely:

```bash
# Create .env file (DO NOT commit this to git!)
cat > .env << 'EOF'
# Database connection
DATABASE_URL=postgresql://username:password@hostname:5432/propertyiq

# Individual components (alternative)
DB_HOST=your-database-host.com
DB_PORT=5432
DB_NAME=propertyiq
DB_USER=your_username
DB_PASSWORD=your_password

# Optional: MLflow tracking server
MLFLOW_TRACKING_URI=sqlite:///mlflow.db
EOF

# Add to .gitignore
echo ".env" >> .gitignore
echo "*.db" >> .gitignore
echo "data/*.parquet" >> .gitignore
echo "models/" >> .gitignore
```

---

## Part 2: Connect to Your Database

### 2.1 Test Your Connection

Create a file to test the database connection:

```python
# scripts/test_connection.py
"""
Test database connectivity.
Run: python scripts/test_connection.py
"""

import os
from dotenv import load_dotenv
import psycopg2

# Load environment variables
load_dotenv()

def test_connection():
    """Test that we can connect to the database."""
    
    # Get connection string from environment
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        # Build from components
        database_url = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    
    print(f"Connecting to database...")
    print(f"Host: {database_url.split('@')[1].split('/')[0]}")
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Test query
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print(f"✅ Connected successfully!")
        print(f"   PostgreSQL version: {version[:50]}...")
        
        # Check some tables
        cursor.execute("""
            SELECT table_name, 
                   pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
            LIMIT 10;
        """)
        
        print(f"\n   Top 10 tables by size:")
        for row in cursor.fetchall():
            print(f"   - {row[0]}: {row[1]}")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    test_connection()
```

Run it:
```bash
python scripts/test_connection.py
```

Expected output:
```
Connecting to database...
Host: your-database-host.com:5432
✅ Connected successfully!
   PostgreSQL version: PostgreSQL 15.4 on x86_64-pc-linux-gnu...

   Top 10 tables by size:
   - zillow_zhvi: 2.3 GB
   - zillow_zori: 1.8 GB
   - census_acs: 890 MB
   ...
```

### 2.2 Create Database Helper Module

```python
# scripts/db.py
"""
Database connection helper.
Import this in other scripts: from db import get_connection, run_query
"""

import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
import polars as pl
import duckdb

load_dotenv()

def get_connection_string():
    """Get database connection string from environment."""
    url = os.getenv('DATABASE_URL')
    if url:
        return url
    
    return f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"

def get_connection():
    """Get a psycopg2 connection."""
    return psycopg2.connect(get_connection_string())

def run_query(sql: str, params: tuple = None) -> list:
    """Run a SQL query and return results as list of dicts."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(sql, params)
    results = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(row) for row in results]

def query_to_polars(sql: str) -> pl.DataFrame:
    """Run a SQL query and return results as Polars DataFrame."""
    conn = get_connection()
    # Use Polars' built-in PostgreSQL reader
    df = pl.read_database(sql, conn)
    conn.close()
    return df

def query_to_duckdb(sql: str) -> duckdb.DuckDBPyRelation:
    """
    Connect DuckDB directly to PostgreSQL for fast analytics.
    Returns a DuckDB relation that can be queried further.
    """
    conn_str = get_connection_string()
    
    # Create DuckDB connection with PostgreSQL extension
    duck = duckdb.connect()
    duck.execute("INSTALL postgres; LOAD postgres;")
    duck.execute(f"ATTACH '{conn_str}' AS pg (TYPE postgres, READ_ONLY);")
    
    return duck.execute(sql)

# Quick test
if __name__ == "__main__":
    # Test basic query
    result = run_query("SELECT COUNT(*) as count FROM geographies")
    print(f"Total geographies: {result[0]['count']:,}")
```

---

## Part 3: Export Data for Analysis

Your PostgreSQL database is great for storage, but ML tools work faster with local files. We'll export relevant data to Parquet format (compressed, fast).

### 3.1 Export Script

```python
# scripts/export_backtest_data.py
"""
Export data from PostgreSQL to Parquet files for fast ML processing.
Run this weekly or when data updates.

Usage: python scripts/export_backtest_data.py
"""

import os
from dotenv import load_dotenv
import polars as pl
from datetime import datetime
from tqdm import tqdm

load_dotenv()

# Import our database helper
from db import get_connection_string

def export_to_parquet():
    """Export all data needed for backtesting to Parquet files."""
    
    conn_str = get_connection_string()
    output_dir = "data"
    os.makedirs(output_dir, exist_ok=True)
    
    print("=" * 60)
    print("EXPORTING DATA FOR ML ANALYSIS")
    print("=" * 60)
    
    exports = [
        {
            "name": "geographies",
            "description": "All geographies with attributes",
            "sql": """
                SELECT 
                    geography_id,
                    geography_type,
                    name,
                    state_fips,
                    county_fips,
                    metro_cbsa,
                    parent_geography_id,
                    population,
                    population_density,
                    land_area_sq_miles
                FROM geographies
            """
        },
        {
            "name": "zillow_current",
            "description": "Latest Zillow metrics per geography",
            "sql": """
                SELECT DISTINCT ON (geography_id)
                    geography_id,
                    data_date,
                    zhvi,
                    zori,
                    median_dom,
                    inventory,
                    pending_ratio,
                    new_listings,
                    price_cut_share,
                    sale_to_list_ratio,
                    zhvi_yoy,
                    zori_yoy
                FROM zillow_combined
                ORDER BY geography_id, data_date DESC
            """
        },
        {
            "name": "zillow_historical",
            "description": "Full Zillow time series (for backtesting)",
            "sql": """
                SELECT 
                    geography_id,
                    data_date,
                    zhvi,
                    zori,
                    median_dom,
                    inventory,
                    pending_ratio
                FROM zillow_combined
                WHERE data_date >= '2015-01-01'
                ORDER BY geography_id, data_date
            """
        },
        {
            "name": "census_latest",
            "description": "Latest Census ACS data",
            "sql": """
                SELECT DISTINCT ON (geography_id)
                    geography_id,
                    year,
                    population,
                    median_income,
                    median_home_value,
                    unemployment_rate,
                    poverty_rate,
                    homeownership_rate,
                    vacancy_rate,
                    median_age,
                    college_rate,
                    median_rent
                FROM census_acs
                ORDER BY geography_id, year DESC
            """
        },
        {
            "name": "economic",
            "description": "Economic indicators",
            "sql": """
                SELECT DISTINCT ON (geography_id)
                    geography_id,
                    data_date,
                    unemployment_rate,
                    employment,
                    employment_yoy,
                    gdp,
                    gdp_yoy
                FROM economic_indicators
                ORDER BY geography_id, data_date DESC
            """
        },
    ]
    
    for export in tqdm(exports, desc="Exporting tables"):
        print(f"\n📦 Exporting: {export['name']}")
        print(f"   {export['description']}")
        
        try:
            # Read from PostgreSQL
            df = pl.read_database_uri(
                export['sql'],
                conn_str,
                engine="adbc"  # Fast connector
            )
            
            # Save to Parquet
            output_path = f"{output_dir}/{export['name']}.parquet"
            df.write_parquet(output_path, compression="zstd")
            
            # Report
            file_size = os.path.getsize(output_path) / (1024 * 1024)
            print(f"   ✅ Exported {len(df):,} rows ({file_size:.1f} MB)")
            
        except Exception as e:
            print(f"   ❌ Failed: {e}")
    
    print("\n" + "=" * 60)
    print("EXPORT COMPLETE")
    print("=" * 60)
    print(f"\nFiles saved to: {os.path.abspath(output_dir)}/")
    
    # List files
    for f in os.listdir(output_dir):
        if f.endswith('.parquet'):
            size = os.path.getsize(f"{output_dir}/{f}") / (1024 * 1024)
            print(f"  - {f}: {size:.1f} MB")

if __name__ == "__main__":
    export_to_parquet()
```

Run the export:
```bash
python scripts/export_backtest_data.py
```

Expected output:
```
============================================================
EXPORTING DATA FOR ML ANALYSIS
============================================================

📦 Exporting: geographies
   All geographies with attributes
   ✅ Exported 67,342 rows (4.2 MB)

📦 Exporting: zillow_current
   Latest Zillow metrics per geography
   ✅ Exported 45,231 rows (2.8 MB)

📦 Exporting: zillow_historical
   Full Zillow time series (for backtesting)
   ✅ Exported 14,234,521 rows (892.3 MB)

...

Files saved to: /path/to/propertyiq-ml/data/
  - geographies.parquet: 4.2 MB
  - zillow_current.parquet: 2.8 MB
  - zillow_historical.parquet: 892.3 MB
  - census_latest.parquet: 12.1 MB
  - economic.parquet: 45.6 MB
```

### 3.2 Load Parquet Files (Super Fast!)

```python
# Quick test: Load data from Parquet
import polars as pl

# Load 14M rows in ~2 seconds (vs 2+ minutes from PostgreSQL)
zillow = pl.read_parquet("data/zillow_historical.parquet")
print(f"Loaded {len(zillow):,} rows")
print(zillow.head())
```

---

## Part 4: Create Backtest Dataset

Now let's create the actual dataset for backtesting — matching historical scores with outcomes.

### 4.1 Backtest Data Preparation Script

```python
# scripts/prepare_backtest_data.py
"""
Prepare the backtest dataset:
1. Load historical data
2. Calculate scores at each historical date
3. Calculate actual outcomes (what happened 1y, 3y, 5y later)
4. Calculate benchmarks
5. Calculate excess returns

Usage: python scripts/prepare_backtest_data.py
"""

import polars as pl
import numpy as np
from datetime import date
from dateutil.relativedelta import relativedelta
from tqdm import tqdm
import os

def prepare_backtest_data():
    print("=" * 60)
    print("PREPARING BACKTEST DATA")
    print("=" * 60)
    
    # ─────────────────────────────────────────────────────────────
    # Step 1: Load data
    # ─────────────────────────────────────────────────────────────
    print("\n[1/6] Loading data...")
    
    geo = pl.read_parquet("data/geographies.parquet")
    zillow = pl.read_parquet("data/zillow_historical.parquet")
    census = pl.read_parquet("data/census_latest.parquet")
    
    print(f"   Geographies: {len(geo):,}")
    print(f"   Zillow records: {len(zillow):,}")
    print(f"   Census records: {len(census):,}")
    
    # ─────────────────────────────────────────────────────────────
    # Step 2: Define score dates (when we "would have" calculated scores)
    # ─────────────────────────────────────────────────────────────
    print("\n[2/6] Setting up score dates...")
    
    # Quarterly dates from 2017 to 2023
    score_dates = []
    for year in range(2017, 2024):
        for month in [1, 4, 7, 10]:
            score_dates.append(date(year, month, 1))
    
    print(f"   Score dates: {len(score_dates)} ({score_dates[0]} to {score_dates[-1]})")
    
    # ─────────────────────────────────────────────────────────────
    # Step 3: For each score date, get metrics and outcomes
    # ─────────────────────────────────────────────────────────────
    print("\n[3/6] Calculating scores and outcomes...")
    
    all_records = []
    
    for score_date in tqdm(score_dates, desc="Processing dates"):
        score_date_str = score_date.strftime("%Y-%m-%d")
        
        # Get metrics AS OF this date (no future data!)
        metrics_at_date = (
            zillow
            .filter(pl.col("data_date") <= score_date_str)
            .sort("data_date", descending=True)
            .group_by("geography_id")
            .first()  # Most recent before score date
        )
        
        # Get outcomes (what happened AFTER this date)
        outcomes = {}
        for horizon_name, months in [("1y", 12), ("3y", 36), ("5y", 60)]:
            outcome_date = score_date + relativedelta(months=months)
            outcome_date_str = outcome_date.strftime("%Y-%m-%d")
            
            future_metrics = (
                zillow
                .filter(pl.col("data_date") <= outcome_date_str)
                .filter(pl.col("data_date") >= (outcome_date - relativedelta(months=2)).strftime("%Y-%m-%d"))
                .sort("data_date", descending=True)
                .group_by("geography_id")
                .first()
                .select([
                    "geography_id",
                    pl.col("zhvi").alias(f"zhvi_{horizon_name}_later"),
                    pl.col("zori").alias(f"zori_{horizon_name}_later"),
                ])
            )
            
            metrics_at_date = metrics_at_date.join(
                future_metrics, 
                on="geography_id", 
                how="left"
            )
        
        # Add score date column
        metrics_at_date = metrics_at_date.with_columns(
            pl.lit(score_date_str).alias("score_date")
        )
        
        all_records.append(metrics_at_date)
    
    # Combine all records
    backtest_df = pl.concat(all_records)
    print(f"   Total backtest records: {len(backtest_df):,}")
    
    # ─────────────────────────────────────────────────────────────
    # Step 4: Calculate price changes (outcomes)
    # ─────────────────────────────────────────────────────────────
    print("\n[4/6] Calculating price changes...")
    
    backtest_df = backtest_df.with_columns([
        # 1-year price change
        ((pl.col("zhvi_1y_later") - pl.col("zhvi")) / pl.col("zhvi")).alias("price_change_1y"),
        # 3-year price change
        ((pl.col("zhvi_3y_later") - pl.col("zhvi")) / pl.col("zhvi")).alias("price_change_3y"),
        # 5-year price change
        ((pl.col("zhvi_5y_later") - pl.col("zhvi")) / pl.col("zhvi")).alias("price_change_5y"),
        # 3-year CAGR
        (
            (pl.col("zhvi_3y_later") / pl.col("zhvi")).pow(1/3) - 1
        ).alias("price_cagr_3y"),
        # 5-year CAGR
        (
            (pl.col("zhvi_5y_later") / pl.col("zhvi")).pow(1/5) - 1
        ).alias("price_cagr_5y"),
    ])
    
    # ─────────────────────────────────────────────────────────────
    # Step 5: Calculate benchmarks
    # ─────────────────────────────────────────────────────────────
    print("\n[5/6] Calculating benchmarks...")
    
    # National benchmark (average across all geographies for each score date)
    national_benchmarks = (
        backtest_df
        .group_by("score_date")
        .agg([
            pl.col("price_change_1y").mean().alias("national_benchmark_1y"),
            pl.col("price_change_3y").mean().alias("national_benchmark_3y"),
            pl.col("price_change_5y").mean().alias("national_benchmark_5y"),
        ])
    )
    
    # Join benchmarks back
    backtest_df = backtest_df.join(national_benchmarks, on="score_date", how="left")
    
    # Calculate excess returns
    backtest_df = backtest_df.with_columns([
        (pl.col("price_change_1y") - pl.col("national_benchmark_1y")).alias("excess_return_1y"),
        (pl.col("price_change_3y") - pl.col("national_benchmark_3y")).alias("excess_return_3y"),
        (pl.col("price_change_5y") - pl.col("national_benchmark_5y")).alias("excess_return_5y"),
    ])
    
    # ─────────────────────────────────────────────────────────────
    # Step 6: Add geography attributes and census data
    # ─────────────────────────────────────────────────────────────
    print("\n[6/6] Adding geography attributes...")
    
    backtest_df = backtest_df.join(
        geo.select(["geography_id", "geography_type", "state_fips", "metro_cbsa", "population_density"]),
        on="geography_id",
        how="left"
    )
    
    backtest_df = backtest_df.join(
        census.select([
            "geography_id", "median_income", "unemployment_rate", 
            "poverty_rate", "homeownership_rate", "college_rate"
        ]),
        on="geography_id",
        how="left"
    )
    
    # ─────────────────────────────────────────────────────────────
    # Save
    # ─────────────────────────────────────────────────────────────
    output_path = "data/backtest_data.parquet"
    backtest_df.write_parquet(output_path, compression="zstd")
    
    file_size = os.path.getsize(output_path) / (1024 * 1024)
    
    print("\n" + "=" * 60)
    print("BACKTEST DATA READY")
    print("=" * 60)
    print(f"\nFile: {output_path}")
    print(f"Size: {file_size:.1f} MB")
    print(f"Records: {len(backtest_df):,}")
    print(f"\nColumns: {backtest_df.columns}")
    
    # Show sample
    print("\nSample record:")
    print(backtest_df.head(1).to_pandas().T)
    
    return backtest_df

if __name__ == "__main__":
    prepare_backtest_data()
```

Run it:
```bash
python scripts/prepare_backtest_data.py
```

---

## Part 5: Run AutoGluon to Find Optimal Weights

Now the fun part — let ML tell you which metrics matter most!

### 5.1 Feature Importance Analysis

```python
# scripts/find_optimal_weights.py
"""
Use AutoGluon to discover which metrics best predict excess returns.
This tells you how to weight your formula components.

Usage: python scripts/find_optimal_weights.py
"""

import polars as pl
import pandas as pd
from autogluon.tabular import TabularPredictor
import os
from datetime import datetime

def find_optimal_weights():
    print("=" * 60)
    print("AUTOGLUON FEATURE IMPORTANCE ANALYSIS")
    print("=" * 60)
    
    # ─────────────────────────────────────────────────────────────
    # Step 1: Load backtest data
    # ─────────────────────────────────────────────────────────────
    print("\n[1/5] Loading data...")
    
    df = pl.read_parquet("data/backtest_data.parquet")
    print(f"   Loaded {len(df):,} records")
    
    # ─────────────────────────────────────────────────────────────
    # Step 2: Define features and target
    # ─────────────────────────────────────────────────────────────
    print("\n[2/5] Preparing features...")
    
    # These are the metrics that could go into your formula
    # (the inputs to your score calculation)
    feature_columns = [
        # Zillow metrics (available at score time)
        'zhvi',                # Home value
        'zori',                # Rent
        'median_dom',          # Days on market
        'inventory',           # Active listings
        'pending_ratio',       # Pending sales ratio
        'zhvi_yoy',            # Price change YoY (at score time)
        'zori_yoy',            # Rent change YoY
        
        # Census/demographic metrics
        'median_income',
        'unemployment_rate',
        'poverty_rate',
        'homeownership_rate',
        'college_rate',
        'population_density',
        
        # Calculated metrics (you may need to add these)
        # 'affordability_index',
        # 'cap_rate',
        # 'rent_to_price',
        # 'volatility_12m',
    ]
    
    # Target: What we're trying to predict
    # Using 1-year excess return (vs national benchmark)
    target = 'excess_return_1y'
    
    # Filter to records that have all required data
    df_clean = df.select(feature_columns + [target, 'score_date', 'geography_type'])
    df_clean = df_clean.drop_nulls(subset=[target])
    
    print(f"   Features: {len(feature_columns)}")
    print(f"   Target: {target}")
    print(f"   Clean records: {len(df_clean):,}")
    
    # ─────────────────────────────────────────────────────────────
    # Step 3: Split train/test BY DATE (important!)
    # ─────────────────────────────────────────────────────────────
    print("\n[3/5] Splitting train/test...")
    
    # Train on older data, test on newer data
    # This prevents data leakage
    train_cutoff = "2022-01-01"
    
    train_df = df_clean.filter(pl.col("score_date") < train_cutoff)
    test_df = df_clean.filter(pl.col("score_date") >= train_cutoff)
    
    print(f"   Train: {len(train_df):,} records (before {train_cutoff})")
    print(f"   Test: {len(test_df):,} records (after {train_cutoff})")
    
    # Convert to pandas for AutoGluon
    train_pd = train_df.select(feature_columns + [target]).to_pandas()
    test_pd = test_df.select(feature_columns + [target]).to_pandas()
    
    # ─────────────────────────────────────────────────────────────
    # Step 4: Train AutoGluon
    # ─────────────────────────────────────────────────────────────
    print("\n[4/5] Training AutoGluon (this takes 10-30 minutes)...")
    print("   AutoGluon will try many different models automatically.")
    
    # Create output directory
    model_path = f"models/autogluon_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Train
    predictor = TabularPredictor(
        label=target,           # What we're predicting
        eval_metric='r2',       # Optimize for R² (correlation)
        path=model_path,
        verbosity=2             # Show progress
    ).fit(
        train_data=train_pd,
        # presets: 'medium_quality' = 30 min, 'best_quality' = 4+ hours
        presets='medium_quality',
        time_limit=1800,        # 30 minutes max
        num_bag_folds=5,        # Cross-validation folds
    )
    
    # ─────────────────────────────────────────────────────────────
    # Step 5: Analyze Results
    # ─────────────────────────────────────────────────────────────
    print("\n[5/5] Analyzing results...")
    
    # Evaluate on test set
    test_results = predictor.evaluate(test_pd)
    print(f"\n   Test R²: {test_results['r2']:.4f}")
    print(f"   (This means {test_results['r2']*100:.1f}% of outcome variance is explained)")
    
    # Get feature importance
    print("\n   Calculating feature importance...")
    importance = predictor.feature_importance(test_pd)
    
    # ─────────────────────────────────────────────────────────────
    # Report
    # ─────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("RESULTS: FEATURE IMPORTANCE")
    print("=" * 60)
    print("\nThis shows which metrics best predict excess returns.")
    print("Higher importance = should have more weight in your formula.\n")
    
    print(f"{'Rank':<6}{'Feature':<25}{'Importance':<12}{'Suggested Weight':<18}")
    print("-" * 60)
    
    total_importance = importance['importance'].sum()
    
    for i, (feature, row) in enumerate(importance.head(15).iterrows()):
        imp = row['importance']
        suggested_weight = (imp / total_importance) * 100
        print(f"{i+1:<6}{feature:<25}{imp:<12.4f}{suggested_weight:>10.1f}%")
    
    # ─────────────────────────────────────────────────────────────
    # Compare to your current formula
    # ─────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("COMPARISON TO YOUR CURRENT FORMULA")
    print("=" * 60)
    
    # Your current HomeReady component weights
    current_formula = {
        'Affordability (30%)': ['median_income', 'zhvi'],  # Price-to-income
        'Market Timing (25%)': ['pending_ratio', 'median_dom', 'inventory'],
        'Stability (20%)': ['zhvi_yoy'],  # Volatility proxy
        'Growth (15%)': ['zhvi_yoy', 'zori_yoy'],
        'Livability (10%)': ['unemployment_rate', 'college_rate'],
    }
    
    print("\nComponent Analysis:")
    print(f"{'Component':<25}{'Current Weight':<15}{'ML Importance':<15}{'Suggestion':<20}")
    print("-" * 75)
    
    for component, metrics in current_formula.items():
        # Get ML importance for this component's metrics
        component_importance = importance.loc[
            importance.index.isin(metrics), 'importance'
        ].sum()
        
        ml_weight = (component_importance / total_importance) * 100
        
        # Extract current weight from component name
        current_weight = float(component.split('(')[1].split('%')[0])
        
        # Suggestion
        diff = ml_weight - current_weight
        if abs(diff) < 3:
            suggestion = "✅ Keep as is"
        elif diff > 0:
            suggestion = f"⬆️ Increase (+{diff:.0f}%)"
        else:
            suggestion = f"⬇️ Decrease ({diff:.0f}%)"
        
        component_name = component.split('(')[0].strip()
        print(f"{component_name:<25}{current_weight:>10.0f}%{ml_weight:>14.1f}%     {suggestion}")
    
    # ─────────────────────────────────────────────────────────────
    # Save results
    # ─────────────────────────────────────────────────────────────
    report_path = f"reports/feature_importance_{datetime.now().strftime('%Y%m%d')}.csv"
    os.makedirs("reports", exist_ok=True)
    importance.to_csv(report_path)
    print(f"\n📊 Full report saved to: {report_path}")
    
    # ─────────────────────────────────────────────────────────────
    # Show model leaderboard
    # ─────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("MODEL LEADERBOARD")
    print("=" * 60)
    print("\nAutoGluon tried these models. The best one is used for analysis:\n")
    
    leaderboard = predictor.leaderboard(test_pd, silent=True)
    print(leaderboard[['model', 'score_test', 'fit_time']].head(10).to_string())
    
    return importance, predictor

if __name__ == "__main__":
    importance, predictor = find_optimal_weights()
```

Run it:
```bash
python scripts/find_optimal_weights.py
```

Expected output:
```
============================================================
AUTOGLUON FEATURE IMPORTANCE ANALYSIS
============================================================

[1/5] Loading data...
   Loaded 2,847,321 records

[2/5] Preparing features...
   Features: 13
   Target: excess_return_1y
   Clean records: 1,923,456

[3/5] Splitting train/test...
   Train: 1,442,592 records (before 2022-01-01)
   Test: 480,864 records (after 2022-01-01)

[4/5] Training AutoGluon (this takes 10-30 minutes)...
   AutoGluon will try many different models automatically.
   ... [AutoGluon progress output] ...

[5/5] Analyzing results...

   Test R²: 0.1847
   (This means 18.5% of outcome variance is explained)

============================================================
RESULTS: FEATURE IMPORTANCE
============================================================

This shows which metrics best predict excess returns.
Higher importance = should have more weight in your formula.

Rank  Feature                  Importance  Suggested Weight
------------------------------------------------------------
1     pending_ratio            0.2341            23.4%
2     zhvi_yoy                 0.1876            18.8%
3     median_income            0.1243            12.4%
4     inventory                0.0987             9.9%
5     unemployment_rate        0.0854             8.5%
6     median_dom               0.0765             7.7%
7     zori_yoy                 0.0654             6.5%
8     homeownership_rate       0.0432             4.3%
9     zhvi                     0.0398             4.0%
10    college_rate             0.0234             2.3%

============================================================
COMPARISON TO YOUR CURRENT FORMULA
============================================================

Component Analysis:
Component                Current Weight ML Importance  Suggestion
---------------------------------------------------------------------------
Affordability                   30%          16.4%     ⬇️ Decrease (-14%)
Market Timing                   25%          40.9%     ⬆️ Increase (+16%)
Stability                       20%          18.8%     ✅ Keep as is
Growth                          15%          25.3%     ⬆️ Increase (+10%)
Livability                      10%          10.8%     ✅ Keep as is

📊 Full report saved to: reports/feature_importance_20260122.csv
```

---

## Part 6: Jupyter Notebook for Interactive Analysis

For exploring data interactively, use Jupyter notebooks.

### 6.1 Start Jupyter

```bash
# Start Jupyter
jupyter notebook
```

This opens a browser. Create a new notebook and try:

```python
# Cell 1: Load libraries
import polars as pl
import plotly.express as px
import plotly.graph_objects as go

# Cell 2: Load backtest data
df = pl.read_parquet("data/backtest_data.parquet")
print(f"Loaded {len(df):,} records")
df.head()

# Cell 3: Visualize feature importance
importance = pl.read_csv("reports/feature_importance_20260122.csv")

fig = px.bar(
    importance.head(15).to_pandas(),
    x='importance',
    y='index',
    orientation='h',
    title='Feature Importance for Predicting Excess Returns'
)
fig.update_layout(yaxis={'categoryorder': 'total ascending'})
fig.show()

# Cell 4: Quintile analysis
# Group by score quintile and see average excess return
df_pd = df.to_pandas()
df_pd['score_quintile'] = pd.qcut(df_pd['zhvi_yoy'], q=5, labels=['Q1 (Low)', 'Q2', 'Q3', 'Q4', 'Q5 (High)'])

quintile_analysis = df_pd.groupby('score_quintile')['excess_return_1y'].agg(['mean', 'std', 'count'])
print(quintile_analysis)

fig = px.bar(
    quintile_analysis.reset_index(),
    x='score_quintile',
    y='mean',
    error_y='std',
    title='Average Excess Return by Price Momentum Quintile'
)
fig.show()
```

---

## Part 7: Quick Reference Commands

### Daily Use

```bash
# Activate environment
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate     # Windows

# Export fresh data from database
python scripts/export_backtest_data.py

# Prepare backtest dataset
python scripts/prepare_backtest_data.py

# Run feature importance analysis
python scripts/find_optimal_weights.py

# Start Jupyter for exploration
jupyter notebook
```

### Check Database Connection

```python
from scripts.db import run_query

# Quick queries
result = run_query("SELECT COUNT(*) FROM geographies")
print(f"Total geographies: {result[0]['count']}")
```

### Load Data Fast

```python
import polars as pl

# From Parquet (fastest)
df = pl.read_parquet("data/backtest_data.parquet")

# Filter efficiently
metros = df.filter(pl.col("geography_type") == "metro")
recent = df.filter(pl.col("score_date") >= "2022-01-01")

# Aggregate
by_date = df.group_by("score_date").agg([
    pl.col("excess_return_1y").mean().alias("avg_excess"),
    pl.count().alias("n")
])
```

---

## Part 8: Troubleshooting

### "ModuleNotFoundError: No module named 'xxx'"

```bash
# Make sure you're in the virtual environment
source venv/bin/activate

# Reinstall the package
pip install xxx
```

### "Connection refused" or database errors

```bash
# Check your .env file has correct credentials
cat .env

# Test connection
python scripts/test_connection.py
```

### AutoGluon runs out of memory

```python
# Use smaller presets
predictor.fit(
    train_data=train_pd,
    presets='medium_quality',  # Instead of 'best_quality'
    time_limit=600,            # Reduce time limit
)

# Or sample your data
train_sample = train_pd.sample(frac=0.2)  # Use 20% of data
```

### Parquet files are too large

```python
# Export only recent data
sql = """
    SELECT * FROM zillow_combined
    WHERE data_date >= '2018-01-01'  -- Limit date range
"""
```

---

## Summary

| What | How | When |
|------|-----|------|
| **Connect to DB** | `scripts/db.py` | Once (setup) |
| **Export data** | `python scripts/export_backtest_data.py` | Weekly |
| **Prepare backtest** | `python scripts/prepare_backtest_data.py` | Weekly |
| **Find optimal weights** | `python scripts/find_optimal_weights.py` | Monthly or after changes |
| **Explore interactively** | `jupyter notebook` | As needed |

The key insight: **AutoGluon's feature importance tells you which metrics actually predict excess returns.** If a metric has high importance but low weight in your formula, increase its weight. If it has low importance but high weight, decrease it.

---

Would you like me to create additional scripts for:
1. Regional/peer benchmark calculations?
2. SHAP explanations for individual scores?
3. MLflow experiment tracking?
4. Automated monthly optimization reports?
