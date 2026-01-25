-- ============================================================================
-- Materialized Views for PropertyIQ Backtesting
-- ============================================================================
-- These views pre-aggregate backtest data for fast analytics queries.
-- Refresh monthly after new data imports.
-- ============================================================================

-- Drop existing views if they exist
DROP MATERIALIZED VIEW IF EXISTS mv_backtest_decile_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_backtest_benchmarks CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_backtest_correlations CASCADE;

-- ============================================================================
-- 1. Decile Statistics by Score Type, Geography, and Period
-- ============================================================================
-- Pre-computes average returns for each score decile bucket
-- This dramatically speeds up decile analysis queries

CREATE MATERIALIZED VIEW mv_backtest_decile_stats AS
WITH score_buckets AS (
  SELECT 
    geography_type,
    period_date,
    -- InvestorEdge deciles
    CASE WHEN investoredge_score IS NOT NULL 
         THEN FLOOR(investoredge_score / 10) * 10 
         ELSE NULL END as ie_decile,
    -- HomeReady deciles  
    CASE WHEN homeready_score IS NOT NULL 
         THEN FLOOR(homeready_score / 10) * 10 
         ELSE NULL END as hr_decile,
    -- Outcomes
    actual_appreciation_6m,
    actual_appreciation_12m,
    actual_appreciation_36m,
    actual_appreciation_60m
  FROM propertyiq_scores_history
  WHERE period_date IS NOT NULL
)
SELECT 
  geography_type,
  period_date,
  'investoredge' as score_type,
  ie_decile as decile,
  -- 6-month horizon
  AVG(actual_appreciation_6m) as avg_return_6m,
  STDDEV(actual_appreciation_6m) as std_return_6m,
  COUNT(actual_appreciation_6m) as count_6m,
  -- 12-month horizon
  AVG(actual_appreciation_12m) as avg_return_12m,
  STDDEV(actual_appreciation_12m) as std_return_12m,
  COUNT(actual_appreciation_12m) as count_12m,
  -- 36-month horizon
  AVG(actual_appreciation_36m) as avg_return_36m,
  STDDEV(actual_appreciation_36m) as std_return_36m,
  COUNT(actual_appreciation_36m) as count_36m,
  -- 60-month horizon
  AVG(actual_appreciation_60m) as avg_return_60m,
  STDDEV(actual_appreciation_60m) as std_return_60m,
  COUNT(actual_appreciation_60m) as count_60m,
  -- Total observations
  COUNT(*) as total_observations
FROM score_buckets
WHERE ie_decile IS NOT NULL
GROUP BY geography_type, period_date, ie_decile

UNION ALL

SELECT 
  geography_type,
  period_date,
  'homeready' as score_type,
  hr_decile as decile,
  AVG(actual_appreciation_6m) as avg_return_6m,
  STDDEV(actual_appreciation_6m) as std_return_6m,
  COUNT(actual_appreciation_6m) as count_6m,
  AVG(actual_appreciation_12m) as avg_return_12m,
  STDDEV(actual_appreciation_12m) as std_return_12m,
  COUNT(actual_appreciation_12m) as count_12m,
  AVG(actual_appreciation_36m) as avg_return_36m,
  STDDEV(actual_appreciation_36m) as std_return_36m,
  COUNT(actual_appreciation_36m) as count_36m,
  AVG(actual_appreciation_60m) as avg_return_60m,
  STDDEV(actual_appreciation_60m) as std_return_60m,
  COUNT(actual_appreciation_60m) as count_60m,
  COUNT(*) as total_observations
FROM score_buckets
WHERE hr_decile IS NOT NULL
GROUP BY geography_type, period_date, hr_decile;

-- Create index for fast lookups
CREATE INDEX idx_mv_decile_stats_lookup 
ON mv_backtest_decile_stats(score_type, geography_type, decile);

CREATE INDEX idx_mv_decile_stats_period 
ON mv_backtest_decile_stats(period_date);


-- ============================================================================
-- 2. National/Regional Benchmarks by Period
-- ============================================================================
-- Pre-computes benchmark returns (mean across all geographies)

CREATE MATERIALIZED VIEW mv_backtest_benchmarks AS
SELECT 
  geography_type,
  period_date,
  -- 6-month benchmark
  AVG(actual_appreciation_6m) as benchmark_6m,
  STDDEV(actual_appreciation_6m) as std_6m,
  COUNT(actual_appreciation_6m) as count_6m,
  -- 12-month benchmark
  AVG(actual_appreciation_12m) as benchmark_12m,
  STDDEV(actual_appreciation_12m) as std_12m,
  COUNT(actual_appreciation_12m) as count_12m,
  -- 36-month benchmark
  AVG(actual_appreciation_36m) as benchmark_36m,
  STDDEV(actual_appreciation_36m) as std_36m,
  COUNT(actual_appreciation_36m) as count_36m,
  -- 60-month benchmark
  AVG(actual_appreciation_60m) as benchmark_60m,
  STDDEV(actual_appreciation_60m) as std_60m,
  COUNT(actual_appreciation_60m) as count_60m,
  -- Total
  COUNT(*) as total_geographies
FROM propertyiq_scores_history
WHERE period_date IS NOT NULL
GROUP BY geography_type, period_date

UNION ALL

-- National benchmark (across all geography types)
SELECT 
  'national' as geography_type,
  period_date,
  AVG(actual_appreciation_6m) as benchmark_6m,
  STDDEV(actual_appreciation_6m) as std_6m,
  COUNT(actual_appreciation_6m) as count_6m,
  AVG(actual_appreciation_12m) as benchmark_12m,
  STDDEV(actual_appreciation_12m) as std_12m,
  COUNT(actual_appreciation_12m) as count_12m,
  AVG(actual_appreciation_36m) as benchmark_36m,
  STDDEV(actual_appreciation_36m) as std_36m,
  COUNT(actual_appreciation_36m) as count_36m,
  AVG(actual_appreciation_60m) as benchmark_60m,
  STDDEV(actual_appreciation_60m) as std_60m,
  COUNT(actual_appreciation_60m) as count_60m,
  COUNT(*) as total_geographies
FROM propertyiq_scores_history
WHERE period_date IS NOT NULL
GROUP BY period_date;

-- Create index
CREATE INDEX idx_mv_benchmarks_lookup 
ON mv_backtest_benchmarks(geography_type, period_date);


-- ============================================================================
-- 3. Summary Statistics for Quick Status Checks
-- ============================================================================

CREATE MATERIALIZED VIEW mv_backtest_summary AS
SELECT 
  geography_type,
  COUNT(*) as total_records,
  COUNT(investoredge_score) as with_investoredge,
  COUNT(homeready_score) as with_homeready,
  COUNT(actual_appreciation_12m) as with_outcome_12m,
  COUNT(actual_appreciation_36m) as with_outcome_36m,
  COUNT(actual_appreciation_60m) as with_outcome_60m,
  MIN(period_date) as earliest_date,
  MAX(period_date) as latest_date,
  AVG(investoredge_score) as avg_ie_score,
  AVG(homeready_score) as avg_hr_score
FROM propertyiq_scores_history
GROUP BY geography_type

UNION ALL

SELECT 
  'all' as geography_type,
  COUNT(*) as total_records,
  COUNT(investoredge_score) as with_investoredge,
  COUNT(homeready_score) as with_homeready,
  COUNT(actual_appreciation_12m) as with_outcome_12m,
  COUNT(actual_appreciation_36m) as with_outcome_36m,
  COUNT(actual_appreciation_60m) as with_outcome_60m,
  MIN(period_date) as earliest_date,
  MAX(period_date) as latest_date,
  AVG(investoredge_score) as avg_ie_score,
  AVG(homeready_score) as avg_hr_score
FROM propertyiq_scores_history;


-- ============================================================================
-- Refresh Function
-- ============================================================================
-- Call this after importing new data

CREATE OR REPLACE FUNCTION refresh_backtest_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_backtest_decile_stats;
  REFRESH MATERIALIZED VIEW mv_backtest_benchmarks;
  REFRESH MATERIALIZED VIEW mv_backtest_summary;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- Initial refresh
-- ============================================================================
-- Uncomment to run initial refresh (may take several minutes for large datasets)
-- SELECT refresh_backtest_views();

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT SELECT ON mv_backtest_decile_stats TO authenticated;
GRANT SELECT ON mv_backtest_decile_stats TO service_role;
GRANT SELECT ON mv_backtest_benchmarks TO authenticated;
GRANT SELECT ON mv_backtest_benchmarks TO service_role;
GRANT SELECT ON mv_backtest_summary TO authenticated;
GRANT SELECT ON mv_backtest_summary TO service_role;
