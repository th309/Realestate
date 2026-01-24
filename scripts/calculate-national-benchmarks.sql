-- Calculate national benchmark appreciation by period
-- This is the US-wide average appreciation for each geography type

SET statement_timeout = '300000';

-- ============================================================================
-- POPULATE NATIONAL BENCHMARKS TABLE
-- ============================================================================

-- Truncate and repopulate
TRUNCATE TABLE backtest_benchmarks;

-- 12m horizon - by geography type and score date
INSERT INTO backtest_benchmarks (score_date, horizon, geography_type, national_avg_appreciation, national_median_appreciation, sample_count)
SELECT
  h.period_date as score_date,
  '12m' as horizon,
  h.geography_type,
  AVG(h.actual_appreciation_12m) as national_avg_appreciation,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY h.actual_appreciation_12m) as national_median_appreciation,
  COUNT(*) as sample_count
FROM propertyiq_scores_history h
WHERE h.actual_appreciation_12m IS NOT NULL
GROUP BY h.period_date, h.geography_type;

SELECT '12m benchmarks' as horizon, COUNT(*) as periods FROM backtest_benchmarks WHERE horizon = '12m';

-- 24m horizon
INSERT INTO backtest_benchmarks (score_date, horizon, geography_type, national_avg_appreciation, national_median_appreciation, sample_count)
SELECT
  h.period_date as score_date,
  '24m' as horizon,
  h.geography_type,
  AVG(h.actual_appreciation_24m) as national_avg_appreciation,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY h.actual_appreciation_24m) as national_median_appreciation,
  COUNT(*) as sample_count
FROM propertyiq_scores_history h
WHERE h.actual_appreciation_24m IS NOT NULL
GROUP BY h.period_date, h.geography_type;

SELECT '24m benchmarks' as horizon, COUNT(*) as periods FROM backtest_benchmarks WHERE horizon = '24m';

-- 36m horizon
INSERT INTO backtest_benchmarks (score_date, horizon, geography_type, national_avg_appreciation, national_median_appreciation, sample_count)
SELECT
  h.period_date as score_date,
  '36m' as horizon,
  h.geography_type,
  AVG(h.actual_appreciation_36m) as national_avg_appreciation,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY h.actual_appreciation_36m) as national_median_appreciation,
  COUNT(*) as sample_count
FROM propertyiq_scores_history h
WHERE h.actual_appreciation_36m IS NOT NULL
GROUP BY h.period_date, h.geography_type;

SELECT '36m benchmarks' as horizon, COUNT(*) as periods FROM backtest_benchmarks WHERE horizon = '36m';

-- 60m horizon
INSERT INTO backtest_benchmarks (score_date, horizon, geography_type, national_avg_appreciation, national_median_appreciation, sample_count)
SELECT
  h.period_date as score_date,
  '60m' as horizon,
  h.geography_type,
  AVG(h.actual_appreciation_60m) as national_avg_appreciation,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY h.actual_appreciation_60m) as national_median_appreciation,
  COUNT(*) as sample_count
FROM propertyiq_scores_history h
WHERE h.actual_appreciation_60m IS NOT NULL
GROUP BY h.period_date, h.geography_type;

SELECT '60m benchmarks' as horizon, COUNT(*) as periods FROM backtest_benchmarks WHERE horizon = '60m';

-- Verify
SELECT horizon, geography_type, COUNT(*) as periods,
  ROUND(AVG(national_avg_appreciation)::numeric, 4) as avg_return
FROM backtest_benchmarks
GROUP BY horizon, geography_type
ORDER BY horizon, geography_type;
