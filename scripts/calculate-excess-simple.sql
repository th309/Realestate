-- Simple excess return calculation - one query per horizon
-- Uses shorter timeout to fail fast

SET statement_timeout = '180000';  -- 3 minutes

-- 12m excess returns
UPDATE propertyiq_scores_history h
SET excess_return_vs_national_12m = h.actual_appreciation_12m - b.national_avg_appreciation
FROM backtest_benchmarks b
WHERE h.actual_appreciation_12m IS NOT NULL
  AND h.excess_return_vs_national_12m IS NULL
  AND b.score_date = h.period_date
  AND b.geography_type = h.geography_type
  AND b.horizon = '12m';

SELECT '12m done' as horizon,
  COUNT(*) FILTER (WHERE excess_return_vs_national_12m IS NOT NULL) as with_excess
FROM propertyiq_scores_history;

-- 24m excess returns
UPDATE propertyiq_scores_history h
SET excess_return_vs_national_24m = h.actual_appreciation_24m - b.national_avg_appreciation
FROM backtest_benchmarks b
WHERE h.actual_appreciation_24m IS NOT NULL
  AND h.excess_return_vs_national_24m IS NULL
  AND b.score_date = h.period_date
  AND b.geography_type = h.geography_type
  AND b.horizon = '24m';

SELECT '24m done' as horizon,
  COUNT(*) FILTER (WHERE excess_return_vs_national_24m IS NOT NULL) as with_excess
FROM propertyiq_scores_history;

-- 36m excess returns
UPDATE propertyiq_scores_history h
SET excess_return_vs_national_36m = h.actual_appreciation_36m - b.national_avg_appreciation
FROM backtest_benchmarks b
WHERE h.actual_appreciation_36m IS NOT NULL
  AND h.excess_return_vs_national_36m IS NULL
  AND b.score_date = h.period_date
  AND b.geography_type = h.geography_type
  AND b.horizon = '36m';

SELECT '36m done' as horizon,
  COUNT(*) FILTER (WHERE excess_return_vs_national_36m IS NOT NULL) as with_excess
FROM propertyiq_scores_history;

-- 60m excess returns
UPDATE propertyiq_scores_history h
SET excess_return_vs_national_60m = h.actual_appreciation_60m - b.national_avg_appreciation
FROM backtest_benchmarks b
WHERE h.actual_appreciation_60m IS NOT NULL
  AND h.excess_return_vs_national_60m IS NULL
  AND b.score_date = h.period_date
  AND b.geography_type = h.geography_type
  AND b.horizon = '60m';

SELECT '60m done' as horizon,
  COUNT(*) FILTER (WHERE excess_return_vs_national_60m IS NOT NULL) as with_excess
FROM propertyiq_scores_history;

-- Final verification
SELECT geography_type,
  COUNT(*) as total,
  COUNT(excess_return_vs_national_12m) as excess_12m,
  COUNT(excess_return_vs_national_24m) as excess_24m,
  COUNT(excess_return_vs_national_36m) as excess_36m,
  COUNT(excess_return_vs_national_60m) as excess_60m
FROM propertyiq_scores_history
GROUP BY geography_type
ORDER BY geography_type;
