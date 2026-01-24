-- County outcomes - by year batches
-- 12m horizon

UPDATE propertyiq_scores_history h
SET actual_appreciation_12m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_county start
JOIN zillow_county future ON future.fips_code = start.fips_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '12 months')
WHERE h.geography_type = 'county'
  AND h.geography_id = start.fips_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_12m IS NULL
  AND h.period_date >= '2023-01-01' AND h.period_date < '2024-01-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_12m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_county start
JOIN zillow_county future ON future.fips_code = start.fips_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '12 months')
WHERE h.geography_type = 'county'
  AND h.geography_id = start.fips_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_12m IS NULL
  AND h.period_date >= '2022-01-01' AND h.period_date < '2023-01-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_12m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_county start
JOIN zillow_county future ON future.fips_code = start.fips_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '12 months')
WHERE h.geography_type = 'county'
  AND h.geography_id = start.fips_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_12m IS NULL
  AND h.period_date >= '2021-01-01' AND h.period_date < '2022-01-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_12m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_county start
JOIN zillow_county future ON future.fips_code = start.fips_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '12 months')
WHERE h.geography_type = 'county'
  AND h.geography_id = start.fips_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_12m IS NULL
  AND h.period_date >= '2020-01-01' AND h.period_date < '2021-01-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_12m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_county start
JOIN zillow_county future ON future.fips_code = start.fips_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '12 months')
WHERE h.geography_type = 'county'
  AND h.geography_id = start.fips_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_12m IS NULL
  AND h.period_date >= '2019-01-01' AND h.period_date < '2020-01-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_12m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_county start
JOIN zillow_county future ON future.fips_code = start.fips_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '12 months')
WHERE h.geography_type = 'county'
  AND h.geography_id = start.fips_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_12m IS NULL
  AND h.period_date >= '2018-01-01' AND h.period_date < '2019-01-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_12m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_county start
JOIN zillow_county future ON future.fips_code = start.fips_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '12 months')
WHERE h.geography_type = 'county'
  AND h.geography_id = start.fips_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_12m IS NULL
  AND h.period_date >= '2017-01-01' AND h.period_date < '2018-01-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_12m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_county start
JOIN zillow_county future ON future.fips_code = start.fips_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '12 months')
WHERE h.geography_type = 'county'
  AND h.geography_id = start.fips_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_12m IS NULL
  AND h.period_date >= '2016-01-01' AND h.period_date < '2017-01-01';

SELECT 'County 12m done' as status;
