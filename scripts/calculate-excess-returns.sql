-- Calculate excess returns vs national benchmark
-- excess_return = actual_appreciation - national_avg

SET statement_timeout = '300000';

-- ============================================================================
-- 12M EXCESS RETURNS
-- ============================================================================
UPDATE propertyiq_scores_history h
SET excess_return_vs_national_12m = h.actual_appreciation_12m - b.national_avg_appreciation
FROM backtest_benchmarks b
WHERE h.actual_appreciation_12m IS NOT NULL
  AND h.excess_return_vs_national_12m IS NULL
  AND b.score_date = h.period_date
  AND b.geography_type = h.geography_type
  AND b.horizon = '12m'
  AND h.period_date >= '2023-01-01';

SELECT '12m 2023+' as batch, COUNT(*) FILTER (WHERE excess_return_vs_national_12m IS NOT NULL) as with_excess,
  COUNT(*) as total FROM propertyiq_scores_history WHERE actual_appreciation_12m IS NOT NULL;

UPDATE propertyiq_scores_history h
SET excess_return_vs_national_12m = h.actual_appreciation_12m - b.national_avg_appreciation
FROM backtest_benchmarks b
WHERE h.actual_appreciation_12m IS NOT NULL
  AND h.excess_return_vs_national_12m IS NULL
  AND b.score_date = h.period_date
  AND b.geography_type = h.geography_type
  AND b.horizon = '12m'
  AND h.period_date >= '2020-01-01' AND h.period_date < '2023-01-01';

SELECT '12m 2020-22' as batch, COUNT(*) FILTER (WHERE excess_return_vs_national_12m IS NOT NULL) as with_excess,
  COUNT(*) as total FROM propertyiq_scores_history WHERE actual_appreciation_12m IS NOT NULL;

UPDATE propertyiq_scores_history h
SET excess_return_vs_national_12m = h.actual_appreciation_12m - b.national_avg_appreciation
FROM backtest_benchmarks b
WHERE h.actual_appreciation_12m IS NOT NULL
  AND h.excess_return_vs_national_12m IS NULL
  AND b.score_date = h.period_date
  AND b.geography_type = h.geography_type
  AND b.horizon = '12m';

SELECT '12m all' as batch, COUNT(*) FILTER (WHERE excess_return_vs_national_12m IS NOT NULL) as with_excess,
  COUNT(*) as total FROM propertyiq_scores_history WHERE actual_appreciation_12m IS NOT NULL;

-- ============================================================================
-- 24M EXCESS RETURNS
-- ============================================================================
UPDATE propertyiq_scores_history h
SET excess_return_vs_national_24m = h.actual_appreciation_24m - b.national_avg_appreciation
FROM backtest_benchmarks b
WHERE h.actual_appreciation_24m IS NOT NULL
  AND h.excess_return_vs_national_24m IS NULL
  AND b.score_date = h.period_date
  AND b.geography_type = h.geography_type
  AND b.horizon = '24m';

SELECT '24m' as batch, COUNT(*) FILTER (WHERE excess_return_vs_national_24m IS NOT NULL) as with_excess,
  COUNT(*) as total FROM propertyiq_scores_history WHERE actual_appreciation_24m IS NOT NULL;

-- ============================================================================
-- 36M EXCESS RETURNS
-- ============================================================================
UPDATE propertyiq_scores_history h
SET excess_return_vs_national_36m = h.actual_appreciation_36m - b.national_avg_appreciation
FROM backtest_benchmarks b
WHERE h.actual_appreciation_36m IS NOT NULL
  AND h.excess_return_vs_national_36m IS NULL
  AND b.score_date = h.period_date
  AND b.geography_type = h.geography_type
  AND b.horizon = '36m';

SELECT '36m' as batch, COUNT(*) FILTER (WHERE excess_return_vs_national_36m IS NOT NULL) as with_excess,
  COUNT(*) as total FROM propertyiq_scores_history WHERE actual_appreciation_36m IS NOT NULL;

-- ============================================================================
-- 60M EXCESS RETURNS
-- ============================================================================
UPDATE propertyiq_scores_history h
SET excess_return_vs_national_60m = h.actual_appreciation_60m - b.national_avg_appreciation
FROM backtest_benchmarks b
WHERE h.actual_appreciation_60m IS NOT NULL
  AND h.excess_return_vs_national_60m IS NULL
  AND b.score_date = h.period_date
  AND b.geography_type = h.geography_type
  AND b.horizon = '60m';

SELECT '60m' as batch, COUNT(*) FILTER (WHERE excess_return_vs_national_60m IS NOT NULL) as with_excess,
  COUNT(*) as total FROM propertyiq_scores_history WHERE actual_appreciation_60m IS NOT NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'FINAL' as status,
  geography_type,
  COUNT(*) as total,
  COUNT(excess_return_vs_national_12m) as has_excess_12m,
  COUNT(excess_return_vs_national_24m) as has_excess_24m,
  COUNT(excess_return_vs_national_36m) as has_excess_36m,
  COUNT(excess_return_vs_national_60m) as has_excess_60m
FROM propertyiq_scores_history
GROUP BY geography_type
ORDER BY geography_type;
