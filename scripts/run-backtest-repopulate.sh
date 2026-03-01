#!/bin/bash
# Runner script for backtest outcome repopulation
# Runs each section as a separate psql call to avoid connection drops

set -e

CONNSTR="postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&options=-c%20tcp_keepalives_idle%3D60%26tcp_keepalives_interval%3D15%26tcp_keepalives_count%3D5"

run_sql() {
  local label="$1"
  local sql="$2"
  echo ""
  echo "============================================"
  echo "  $label"
  echo "============================================"
  echo "$sql" | PGPASSWORD="IHatedoingpt12" psql "postgresql://postgres.pysflbhpnqwoczyuaaif@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require" -v ON_ERROR_STOP=1 --no-psqlrc 2>&1
  echo "  ✓ $label complete"
}

echo "Starting backtest outcome repopulation..."
echo "$(date)"

# =============================================
# Section 1: Fix metro + county prices (COALESCE)
# =============================================
run_sql "Section 1a: Metro prices (COALESCE fix)" "
SET statement_timeout = '0';
UPDATE propertyiq_backtest_outcomes o
SET
  outcome_6m_value = COALESCE(
    CASE WHEN p_start.price_value > 0 AND p_6m.price_value IS NOT NULL
    THEN ROUND(((p_6m.price_value - p_start.price_value) / p_start.price_value) * 100, 4) END,
    o.outcome_6m_value),
  outcome_1y_value = COALESCE(
    CASE WHEN p_start.price_value > 0 AND p_1y.price_value IS NOT NULL
    THEN ROUND(((p_1y.price_value - p_start.price_value) / p_start.price_value) * 100, 4) END,
    o.outcome_1y_value),
  outcome_3y_value = COALESCE(
    CASE WHEN p_start.price_value > 0 AND p_3y.price_value IS NOT NULL
    THEN ROUND((POW(p_3y.price_value / p_start.price_value, 1.0/3) - 1) * 100, 4) END,
    o.outcome_3y_value),
  outcome_5y_value = COALESCE(
    CASE WHEN p_start.price_value > 0 AND p_5y.price_value IS NOT NULL
    THEN ROUND((POW(p_5y.price_value / p_start.price_value, 1.0/5) - 1) * 100, 4) END,
    o.outcome_5y_value)
FROM _staging_outcome_months om
JOIN _staging_price_metro p_start ON p_start.geo_id = om.geography_id AND p_start.price_date = om.score_month
LEFT JOIN _staging_price_metro p_6m  ON p_6m.geo_id  = om.geography_id AND p_6m.price_date  = (om.score_month + INTERVAL '6 months')::date
LEFT JOIN _staging_price_metro p_1y  ON p_1y.geo_id  = om.geography_id AND p_1y.price_date  = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_price_metro p_3y  ON p_3y.geo_id  = om.geography_id AND p_3y.price_date  = (om.score_month + INTERVAL '3 years')::date
LEFT JOIN _staging_price_metro p_5y  ON p_5y.geo_id  = om.geography_id AND p_5y.price_date  = (om.score_month + INTERVAL '5 years')::date
WHERE om.geography_type = 'metro' AND o.id = om.id;
"

run_sql "Section 1b: County prices (COALESCE fix)" "
SET statement_timeout = '0';
UPDATE propertyiq_backtest_outcomes o
SET
  outcome_6m_value = COALESCE(
    CASE WHEN p_start.price_value > 0 AND p_6m.price_value IS NOT NULL
    THEN ROUND(((p_6m.price_value - p_start.price_value) / p_start.price_value) * 100, 4) END,
    o.outcome_6m_value),
  outcome_1y_value = COALESCE(
    CASE WHEN p_start.price_value > 0 AND p_1y.price_value IS NOT NULL
    THEN ROUND(((p_1y.price_value - p_start.price_value) / p_start.price_value) * 100, 4) END,
    o.outcome_1y_value),
  outcome_3y_value = COALESCE(
    CASE WHEN p_start.price_value > 0 AND p_3y.price_value IS NOT NULL
    THEN ROUND((POW(p_3y.price_value / p_start.price_value, 1.0/3) - 1) * 100, 4) END,
    o.outcome_3y_value),
  outcome_5y_value = COALESCE(
    CASE WHEN p_start.price_value > 0 AND p_5y.price_value IS NOT NULL
    THEN ROUND((POW(p_5y.price_value / p_start.price_value, 1.0/5) - 1) * 100, 4) END,
    o.outcome_5y_value)
FROM _staging_outcome_months om
JOIN _staging_price_county p_start ON p_start.geo_id = om.geography_id AND p_start.price_date = om.score_month
LEFT JOIN _staging_price_county p_6m  ON p_6m.geo_id  = om.geography_id AND p_6m.price_date  = (om.score_month + INTERVAL '6 months')::date
LEFT JOIN _staging_price_county p_1y  ON p_1y.geo_id  = om.geography_id AND p_1y.price_date  = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_price_county p_3y  ON p_3y.geo_id  = om.geography_id AND p_3y.price_date  = (om.score_month + INTERVAL '3 years')::date
LEFT JOIN _staging_price_county p_5y  ON p_5y.geo_id  = om.geography_id AND p_5y.price_date  = (om.score_month + INTERVAL '5 years')::date
WHERE om.geography_type = 'county' AND o.id = om.id;
"

# =============================================
# Sections 2-4: ZIP prices (3 batches)
# =============================================
run_sql "Section 2: ZIP prices batch 1 (pre-2022)" "
SET statement_timeout = '0';
UPDATE propertyiq_backtest_outcomes o
SET
  outcome_6m_value = COALESCE(CASE WHEN p_start.price_value > 0 AND p_6m.price_value IS NOT NULL THEN ROUND(((p_6m.price_value - p_start.price_value) / p_start.price_value) * 100, 4) END, o.outcome_6m_value),
  outcome_1y_value = COALESCE(CASE WHEN p_start.price_value > 0 AND p_1y.price_value IS NOT NULL THEN ROUND(((p_1y.price_value - p_start.price_value) / p_start.price_value) * 100, 4) END, o.outcome_1y_value),
  outcome_3y_value = COALESCE(CASE WHEN p_start.price_value > 0 AND p_3y.price_value IS NOT NULL THEN ROUND((POW(p_3y.price_value / p_start.price_value, 1.0/3) - 1) * 100, 4) END, o.outcome_3y_value),
  outcome_5y_value = COALESCE(CASE WHEN p_start.price_value > 0 AND p_5y.price_value IS NOT NULL THEN ROUND((POW(p_5y.price_value / p_start.price_value, 1.0/5) - 1) * 100, 4) END, o.outcome_5y_value)
FROM _staging_outcome_months om
JOIN _staging_price_zip p_start ON p_start.geo_id = om.geography_id AND p_start.price_date = om.score_month
LEFT JOIN _staging_price_zip p_6m ON p_6m.geo_id = om.geography_id AND p_6m.price_date = (om.score_month + INTERVAL '6 months')::date
LEFT JOIN _staging_price_zip p_1y ON p_1y.geo_id = om.geography_id AND p_1y.price_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_price_zip p_3y ON p_3y.geo_id = om.geography_id AND p_3y.price_date = (om.score_month + INTERVAL '3 years')::date
LEFT JOIN _staging_price_zip p_5y ON p_5y.geo_id = om.geography_id AND p_5y.price_date = (om.score_month + INTERVAL '5 years')::date
WHERE om.geography_type = 'zip' AND om.score_month < '2022-01-01' AND o.id = om.id;
"

run_sql "Section 3: ZIP prices batch 2 (2022-2023)" "
SET statement_timeout = '0';
UPDATE propertyiq_backtest_outcomes o
SET
  outcome_6m_value = COALESCE(CASE WHEN p_start.price_value > 0 AND p_6m.price_value IS NOT NULL THEN ROUND(((p_6m.price_value - p_start.price_value) / p_start.price_value) * 100, 4) END, o.outcome_6m_value),
  outcome_1y_value = COALESCE(CASE WHEN p_start.price_value > 0 AND p_1y.price_value IS NOT NULL THEN ROUND(((p_1y.price_value - p_start.price_value) / p_start.price_value) * 100, 4) END, o.outcome_1y_value),
  outcome_3y_value = COALESCE(CASE WHEN p_start.price_value > 0 AND p_3y.price_value IS NOT NULL THEN ROUND((POW(p_3y.price_value / p_start.price_value, 1.0/3) - 1) * 100, 4) END, o.outcome_3y_value),
  outcome_5y_value = COALESCE(CASE WHEN p_start.price_value > 0 AND p_5y.price_value IS NOT NULL THEN ROUND((POW(p_5y.price_value / p_start.price_value, 1.0/5) - 1) * 100, 4) END, o.outcome_5y_value)
FROM _staging_outcome_months om
JOIN _staging_price_zip p_start ON p_start.geo_id = om.geography_id AND p_start.price_date = om.score_month
LEFT JOIN _staging_price_zip p_6m ON p_6m.geo_id = om.geography_id AND p_6m.price_date = (om.score_month + INTERVAL '6 months')::date
LEFT JOIN _staging_price_zip p_1y ON p_1y.geo_id = om.geography_id AND p_1y.price_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_price_zip p_3y ON p_3y.geo_id = om.geography_id AND p_3y.price_date = (om.score_month + INTERVAL '3 years')::date
LEFT JOIN _staging_price_zip p_5y ON p_5y.geo_id = om.geography_id AND p_5y.price_date = (om.score_month + INTERVAL '5 years')::date
WHERE om.geography_type = 'zip' AND om.score_month >= '2022-01-01' AND om.score_month < '2024-01-01' AND o.id = om.id;
"

run_sql "Section 4: ZIP prices batch 3 (2024+)" "
SET statement_timeout = '0';
UPDATE propertyiq_backtest_outcomes o
SET
  outcome_6m_value = COALESCE(CASE WHEN p_start.price_value > 0 AND p_6m.price_value IS NOT NULL THEN ROUND(((p_6m.price_value - p_start.price_value) / p_start.price_value) * 100, 4) END, o.outcome_6m_value),
  outcome_1y_value = COALESCE(CASE WHEN p_start.price_value > 0 AND p_1y.price_value IS NOT NULL THEN ROUND(((p_1y.price_value - p_start.price_value) / p_start.price_value) * 100, 4) END, o.outcome_1y_value),
  outcome_3y_value = COALESCE(CASE WHEN p_start.price_value > 0 AND p_3y.price_value IS NOT NULL THEN ROUND((POW(p_3y.price_value / p_start.price_value, 1.0/3) - 1) * 100, 4) END, o.outcome_3y_value),
  outcome_5y_value = COALESCE(CASE WHEN p_start.price_value > 0 AND p_5y.price_value IS NOT NULL THEN ROUND((POW(p_5y.price_value / p_start.price_value, 1.0/5) - 1) * 100, 4) END, o.outcome_5y_value)
FROM _staging_outcome_months om
JOIN _staging_price_zip p_start ON p_start.geo_id = om.geography_id AND p_start.price_date = om.score_month
LEFT JOIN _staging_price_zip p_6m ON p_6m.geo_id = om.geography_id AND p_6m.price_date = (om.score_month + INTERVAL '6 months')::date
LEFT JOIN _staging_price_zip p_1y ON p_1y.geo_id = om.geography_id AND p_1y.price_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_price_zip p_3y ON p_3y.geo_id = om.geography_id AND p_3y.price_date = (om.score_month + INTERVAL '3 years')::date
LEFT JOIN _staging_price_zip p_5y ON p_5y.geo_id = om.geography_id AND p_5y.price_date = (om.score_month + INTERVAL '5 years')::date
WHERE om.geography_type = 'zip' AND om.score_month >= '2024-01-01' AND o.id = om.id;
"

# =============================================
# Section 5: Rent (metro + county)
# =============================================
run_sql "Section 5a: Metro rent" "
SET statement_timeout = '0';
UPDATE propertyiq_backtest_outcomes o
SET
  rent_return_1y = COALESCE(CASE WHEN r_start.rent_value > 0 AND r_1y.rent_value IS NOT NULL THEN ROUND(((r_1y.rent_value - r_start.rent_value) / r_start.rent_value) * 100, 4) END, o.rent_return_1y),
  rent_return_3y_cagr = COALESCE(CASE WHEN r_start.rent_value > 0 AND r_3y.rent_value IS NOT NULL THEN ROUND((POW(r_3y.rent_value / r_start.rent_value, 1.0/3) - 1) * 100, 4) END, o.rent_return_3y_cagr)
FROM _staging_outcome_months om
JOIN _staging_rent r_start ON r_start.geo_type = 'metro' AND r_start.geo_id = om.geography_id AND r_start.rent_date = om.score_month
LEFT JOIN _staging_rent r_1y ON r_1y.geo_type = 'metro' AND r_1y.geo_id = om.geography_id AND r_1y.rent_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_rent r_3y ON r_3y.geo_type = 'metro' AND r_3y.geo_id = om.geography_id AND r_3y.rent_date = (om.score_month + INTERVAL '3 years')::date
WHERE om.geography_type = 'metro' AND o.id = om.id;
"

run_sql "Section 5b: County rent" "
SET statement_timeout = '0';
UPDATE propertyiq_backtest_outcomes o
SET
  rent_return_1y = COALESCE(CASE WHEN r_start.rent_value > 0 AND r_1y.rent_value IS NOT NULL THEN ROUND(((r_1y.rent_value - r_start.rent_value) / r_start.rent_value) * 100, 4) END, o.rent_return_1y),
  rent_return_3y_cagr = COALESCE(CASE WHEN r_start.rent_value > 0 AND r_3y.rent_value IS NOT NULL THEN ROUND((POW(r_3y.rent_value / r_start.rent_value, 1.0/3) - 1) * 100, 4) END, o.rent_return_3y_cagr)
FROM _staging_outcome_months om
JOIN _staging_rent r_start ON r_start.geo_type = 'county' AND r_start.geo_id = om.geography_id AND r_start.rent_date = om.score_month
LEFT JOIN _staging_rent r_1y ON r_1y.geo_type = 'county' AND r_1y.geo_id = om.geography_id AND r_1y.rent_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_rent r_3y ON r_3y.geo_type = 'county' AND r_3y.geo_id = om.geography_id AND r_3y.rent_date = (om.score_month + INTERVAL '3 years')::date
WHERE om.geography_type = 'county' AND o.id = om.id;
"

# =============================================
# Section 6: ZIP rent (2 batches)
# =============================================
run_sql "Section 6a: ZIP rent batch 1 (pre-2023)" "
SET statement_timeout = '0';
UPDATE propertyiq_backtest_outcomes o
SET
  rent_return_1y = COALESCE(CASE WHEN r_start.rent_value > 0 AND r_1y.rent_value IS NOT NULL THEN ROUND(((r_1y.rent_value - r_start.rent_value) / r_start.rent_value) * 100, 4) END, o.rent_return_1y),
  rent_return_3y_cagr = COALESCE(CASE WHEN r_start.rent_value > 0 AND r_3y.rent_value IS NOT NULL THEN ROUND((POW(r_3y.rent_value / r_start.rent_value, 1.0/3) - 1) * 100, 4) END, o.rent_return_3y_cagr)
FROM _staging_outcome_months om
JOIN _staging_rent r_start ON r_start.geo_type = 'zip' AND r_start.geo_id = om.geography_id AND r_start.rent_date = om.score_month
LEFT JOIN _staging_rent r_1y ON r_1y.geo_type = 'zip' AND r_1y.geo_id = om.geography_id AND r_1y.rent_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_rent r_3y ON r_3y.geo_type = 'zip' AND r_3y.geo_id = om.geography_id AND r_3y.rent_date = (om.score_month + INTERVAL '3 years')::date
WHERE om.geography_type = 'zip' AND om.score_month < '2023-01-01' AND o.id = om.id;
"

run_sql "Section 6b: ZIP rent batch 2 (2023+)" "
SET statement_timeout = '0';
UPDATE propertyiq_backtest_outcomes o
SET
  rent_return_1y = COALESCE(CASE WHEN r_start.rent_value > 0 AND r_1y.rent_value IS NOT NULL THEN ROUND(((r_1y.rent_value - r_start.rent_value) / r_start.rent_value) * 100, 4) END, o.rent_return_1y),
  rent_return_3y_cagr = COALESCE(CASE WHEN r_start.rent_value > 0 AND r_3y.rent_value IS NOT NULL THEN ROUND((POW(r_3y.rent_value / r_start.rent_value, 1.0/3) - 1) * 100, 4) END, o.rent_return_3y_cagr)
FROM _staging_outcome_months om
JOIN _staging_rent r_start ON r_start.geo_type = 'zip' AND r_start.geo_id = om.geography_id AND r_start.rent_date = om.score_month
LEFT JOIN _staging_rent r_1y ON r_1y.geo_type = 'zip' AND r_1y.geo_id = om.geography_id AND r_1y.rent_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_rent r_3y ON r_3y.geo_type = 'zip' AND r_3y.geo_id = om.geography_id AND r_3y.rent_date = (om.score_month + INTERVAL '3 years')::date
WHERE om.geography_type = 'zip' AND om.score_month >= '2023-01-01' AND o.id = om.id;
"

# =============================================
# Section 7: State benchmarks
# =============================================
run_sql "Section 7a: State ZHVI benchmarks" "
SET statement_timeout = '0';
UPDATE propertyiq_backtest_outcomes o
SET
  state_return_1y = COALESCE(CASE WHEN bs.value > 0 AND bs_1y.value IS NOT NULL THEN ROUND(((bs_1y.value - bs.value) / bs.value) * 100, 4) END, o.state_return_1y),
  state_return_3y_cagr = COALESCE(CASE WHEN bs.value > 0 AND bs_3y.value IS NOT NULL THEN ROUND((POW(bs_3y.value / bs.value, 1.0/3) - 1) * 100, 4) END, o.state_return_3y_cagr),
  state_return_5y_cagr = COALESCE(CASE WHEN bs.value > 0 AND bs_5y.value IS NOT NULL THEN ROUND((POW(bs_5y.value / bs.value, 1.0/5) - 1) * 100, 4) END, o.state_return_5y_cagr)
FROM _staging_outcome_months om
JOIN _staging_benchmark_state bs ON bs.state_code = om.state_code AND bs.metric_name = 'zhvi' AND bs.bench_date = om.score_month
LEFT JOIN _staging_benchmark_state bs_1y ON bs_1y.state_code = om.state_code AND bs_1y.metric_name = 'zhvi' AND bs_1y.bench_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_benchmark_state bs_3y ON bs_3y.state_code = om.state_code AND bs_3y.metric_name = 'zhvi' AND bs_3y.bench_date = (om.score_month + INTERVAL '3 years')::date
LEFT JOIN _staging_benchmark_state bs_5y ON bs_5y.state_code = om.state_code AND bs_5y.metric_name = 'zhvi' AND bs_5y.bench_date = (om.score_month + INTERVAL '5 years')::date
WHERE om.state_code IS NOT NULL AND o.id = om.id;
"

run_sql "Section 7b: State ZORI benchmarks" "
SET statement_timeout = '0';
UPDATE propertyiq_backtest_outcomes o
SET
  state_rent_return_1y = COALESCE(CASE WHEN bs.value > 0 AND bs_1y.value IS NOT NULL THEN ROUND(((bs_1y.value - bs.value) / bs.value) * 100, 4) END, o.state_rent_return_1y),
  state_rent_return_3y_cagr = COALESCE(CASE WHEN bs.value > 0 AND bs_3y.value IS NOT NULL THEN ROUND((POW(bs_3y.value / bs.value, 1.0/3) - 1) * 100, 4) END, o.state_rent_return_3y_cagr)
FROM _staging_outcome_months om
JOIN _staging_benchmark_state bs ON bs.state_code = om.state_code AND bs.metric_name = 'zori' AND bs.bench_date = om.score_month
LEFT JOIN _staging_benchmark_state bs_1y ON bs_1y.state_code = om.state_code AND bs_1y.metric_name = 'zori' AND bs_1y.bench_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_benchmark_state bs_3y ON bs_3y.state_code = om.state_code AND bs_3y.metric_name = 'zori' AND bs_3y.bench_date = (om.score_month + INTERVAL '3 years')::date
WHERE om.state_code IS NOT NULL AND o.id = om.id;
"

# =============================================
# Section 8: Excess returns + verification + cleanup
# =============================================
run_sql "Section 8: Excess returns" "
SET statement_timeout = '0';
UPDATE propertyiq_backtest_outcomes
SET
  excess_vs_state_1y = CASE WHEN outcome_1y_value IS NOT NULL AND state_return_1y IS NOT NULL THEN outcome_1y_value - state_return_1y END,
  excess_vs_state_3y = CASE WHEN outcome_3y_value IS NOT NULL AND state_return_3y_cagr IS NOT NULL THEN outcome_3y_value - state_return_3y_cagr END,
  excess_vs_state_5y = CASE WHEN outcome_5y_value IS NOT NULL AND state_return_5y_cagr IS NOT NULL THEN outcome_5y_value - state_return_5y_cagr END,
  excess_vs_national_1y = CASE WHEN outcome_1y_value IS NOT NULL AND national_return_1y IS NOT NULL THEN outcome_1y_value - national_return_1y END,
  excess_vs_national_3y = CASE WHEN outcome_3y_value IS NOT NULL AND national_return_3y_cagr IS NOT NULL THEN outcome_3y_value - national_return_3y_cagr END,
  excess_vs_national_5y = CASE WHEN outcome_5y_value IS NOT NULL AND national_return_5y_cagr IS NOT NULL THEN outcome_5y_value - national_return_5y_cagr END
WHERE outcome_1y_value IS NOT NULL OR state_return_1y IS NOT NULL OR national_return_1y IS NOT NULL;
"

run_sql "Final verification" "
SELECT geography_type,
  COUNT(*) AS total, COUNT(state_code) AS state_code,
  COUNT(outcome_6m_value) AS o6m, COUNT(outcome_1y_value) AS o1y,
  COUNT(outcome_3y_value) AS o3y, COUNT(outcome_5y_value) AS o5y,
  COUNT(rent_return_1y) AS rent1y, COUNT(rent_return_3y_cagr) AS rent3y,
  COUNT(state_return_1y) AS st1y, COUNT(state_return_5y_cagr) AS st5y,
  COUNT(state_rent_return_1y) AS strent1y,
  COUNT(excess_vs_state_1y) AS exst1y
FROM propertyiq_backtest_outcomes
GROUP BY geography_type ORDER BY geography_type;
"

run_sql "Spot check - Dallas metro" "
SELECT geography_id, score_date, outcome_6m_value, outcome_1y_value, outcome_3y_value,
  rent_return_1y, state_return_1y, state_rent_return_1y, excess_vs_state_1y
FROM propertyiq_backtest_outcomes
WHERE geography_id = '19100' AND geography_type = 'metro'
ORDER BY score_date DESC LIMIT 5;
"

run_sql "Cleanup staging tables" "
DROP TABLE IF EXISTS _staging_price_metro;
DROP TABLE IF EXISTS _staging_price_county;
DROP TABLE IF EXISTS _staging_price_zip;
DROP TABLE IF EXISTS _staging_rent;
DROP TABLE IF EXISTS _staging_benchmark_state;
DROP TABLE IF EXISTS _staging_outcome_months;
DROP TABLE IF EXISTS _staging_state_fips_map;
DROP TABLE IF EXISTS _staging_cbsa_state_map;
DROP TABLE IF EXISTS _staging_zip_state_map;
DROP INDEX IF EXISTS idx_backtest_null_state_code;
"

echo ""
echo "============================================"
echo "  ALL DONE"
echo "  $(date)"
echo "============================================"
