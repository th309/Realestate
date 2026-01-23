# PropertyIQ ML Pipeline

Python scripts for PropertyIQ scoring formula optimization and validation.

## Setup

1. Create a virtual environment:
   ```bash
   cd propertyiq-ml
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

## Workflow Steps

Run the scripts in order:

### 1. Data Export
Export database data to Parquet files for ML processing.
```bash
python scripts/export_backtest_data.py
```
**Outputs:** `data/geographies.parquet`, `data/zillow_historical.parquet`, `data/census_latest.parquet`, `data/economic.parquet`

### 2. Prepare Backtest Data
Create backtest dataset with historical scores and actual outcomes.
```bash
python scripts/prepare_backtest_data.py
python scripts/prepare_backtest_data.py --start-date 2018-01-01 --end-date 2023-01-01
```
**Outputs:** `data/backtest_data.parquet`

### 3. Calculate Benchmarks
Compute national, regional, and peer group benchmarks for excess returns.
```bash
python scripts/calculate_benchmarks.py
```
**Outputs:** `data/backtest_with_benchmarks.parquet`, `data/benchmarks_*.parquet`

### 4. Feature Analysis (AutoGluon)
ML-based feature importance and optimal weight suggestions.
```bash
python scripts/find_optimal_weights.py
python scripts/find_optimal_weights.py --time-limit 600  # 10 minutes
```
**Outputs:** `data/feature_importance_YYYYMMDD.csv`, `models/autogluon_YYYYMMDD/`

### 5. Score Explanations (SHAP)
Generate SHAP explanations showing why each score is what it is.
```bash
python scripts/generate_shap_explanations.py                      # Sample
python scripts/generate_shap_explanations.py --geography-id 60601 # Single
python scripts/generate_shap_explanations.py --batch              # All
```
**Outputs:** `data/explanations_YYYYMMDD.json`

### 6. Monthly Report
Generate formula health report with confidence matrix and recommendations.
```bash
python scripts/generate_monthly_report.py
python scripts/generate_monthly_report.py --month 2026-01
python scripts/generate_monthly_report.py --notify  # Send Slack notification
```
**Outputs:** `reports/monthly_report_YYYY-MM.json`, `reports/monthly_report_YYYY-MM.html`

## Directory Structure

```
propertyiq-ml/
├── scripts/           # Python scripts
│   ├── db.py                          # Database helper
│   ├── export_backtest_data.py        # Step 1
│   ├── prepare_backtest_data.py       # Step 2
│   ├── calculate_benchmarks.py        # Step 3
│   ├── find_optimal_weights.py        # Step 4
│   ├── generate_shap_explanations.py  # Step 5
│   └── generate_monthly_report.py     # Step 6
├── data/              # Parquet files and CSVs
├── models/            # Saved AutoGluon models
├── reports/           # Generated HTML/JSON reports
├── requirements.txt   # Python dependencies
├── .env.example       # Environment template
└── README.md          # This file
```

## Integration with Web UI

These scripts are triggered from the admin UI at `/admin/ml-workflow`. The Node.js backend:
1. Spawns Python processes for each script
2. Parses `PROGRESS:XX` from stdout to track progress
3. Stores job status in `propertyiq_ml_jobs` table
4. Serves generated reports via API endpoints
