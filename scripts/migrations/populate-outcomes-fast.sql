-- Fast Outcome Population via SQL
-- Calculates appreciation by joining history with Zillow tables directly
-- Much faster than individual API calls

-- ============================================================================
-- STATE OUTCOMES (12m horizon)
-- ============================================================================
UPDATE propertyiq_scores_history h
SET actual_appreciation_12m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_state start
JOIN zillow_state future ON future.state_code = start.state_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '12 months')
WHERE h.geography_type = 'state'
  AND h.geography_id = start.state_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_12m IS NULL
  AND h.period_date <= '2024-12-01';

-- STATE OUTCOMES (24m horizon)
UPDATE propertyiq_scores_history h
SET actual_appreciation_24m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_state start
JOIN zillow_state future ON future.state_code = start.state_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '24 months')
WHERE h.geography_type = 'state'
  AND h.geography_id = start.state_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_24m IS NULL
  AND h.period_date <= '2023-12-01';

-- STATE OUTCOMES (36m horizon)
UPDATE propertyiq_scores_history h
SET actual_appreciation_36m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_state start
JOIN zillow_state future ON future.state_code = start.state_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '36 months')
WHERE h.geography_type = 'state'
  AND h.geography_id = start.state_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_36m IS NULL
  AND h.period_date <= '2022-12-01';

-- STATE OUTCOMES (60m horizon)
UPDATE propertyiq_scores_history h
SET actual_appreciation_60m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_state start
JOIN zillow_state future ON future.state_code = start.state_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '60 months')
WHERE h.geography_type = 'state'
  AND h.geography_id = start.state_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_60m IS NULL
  AND h.period_date <= '2020-12-01';

-- ============================================================================
-- METRO OUTCOMES
-- ============================================================================
UPDATE propertyiq_scores_history h
SET actual_appreciation_12m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_metro start
JOIN zillow_metro future ON future.cbsa_code = start.cbsa_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '12 months')
WHERE h.geography_type = 'metro'
  AND h.geography_id = start.cbsa_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_12m IS NULL
  AND h.period_date <= '2024-12-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_24m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_metro start
JOIN zillow_metro future ON future.cbsa_code = start.cbsa_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '24 months')
WHERE h.geography_type = 'metro'
  AND h.geography_id = start.cbsa_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_24m IS NULL
  AND h.period_date <= '2023-12-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_36m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_metro start
JOIN zillow_metro future ON future.cbsa_code = start.cbsa_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '36 months')
WHERE h.geography_type = 'metro'
  AND h.geography_id = start.cbsa_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_36m IS NULL
  AND h.period_date <= '2022-12-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_60m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_metro start
JOIN zillow_metro future ON future.cbsa_code = start.cbsa_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '60 months')
WHERE h.geography_type = 'metro'
  AND h.geography_id = start.cbsa_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_60m IS NULL
  AND h.period_date <= '2020-12-01';

-- ============================================================================
-- COUNTY OUTCOMES
-- ============================================================================
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
  AND h.period_date <= '2024-12-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_24m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_county start
JOIN zillow_county future ON future.fips_code = start.fips_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '24 months')
WHERE h.geography_type = 'county'
  AND h.geography_id = start.fips_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_24m IS NULL
  AND h.period_date <= '2023-12-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_36m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_county start
JOIN zillow_county future ON future.fips_code = start.fips_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '36 months')
WHERE h.geography_type = 'county'
  AND h.geography_id = start.fips_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_36m IS NULL
  AND h.period_date <= '2022-12-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_60m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_county start
JOIN zillow_county future ON future.fips_code = start.fips_code
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '60 months')
WHERE h.geography_type = 'county'
  AND h.geography_id = start.fips_code
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_60m IS NULL
  AND h.period_date <= '2020-12-01';

-- ============================================================================
-- ZIP OUTCOMES
-- ============================================================================
UPDATE propertyiq_scores_history h
SET actual_appreciation_12m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_zip start
JOIN zillow_zip future ON future.region_name = start.region_name
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '12 months')
WHERE h.geography_type = 'zip'
  AND h.geography_id = start.region_name
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_12m IS NULL
  AND h.period_date <= '2024-12-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_24m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_zip start
JOIN zillow_zip future ON future.region_name = start.region_name
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '24 months')
WHERE h.geography_type = 'zip'
  AND h.geography_id = start.region_name
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_24m IS NULL
  AND h.period_date <= '2023-12-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_36m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_zip start
JOIN zillow_zip future ON future.region_name = start.region_name
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '36 months')
WHERE h.geography_type = 'zip'
  AND h.geography_id = start.region_name
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_36m IS NULL
  AND h.period_date <= '2022-12-01';

UPDATE propertyiq_scores_history h
SET actual_appreciation_60m = ROUND(((future.value - start.value) / NULLIF(start.value, 0))::numeric, 3),
    outcomes_updated_at = NOW()
FROM zillow_zip start
JOIN zillow_zip future ON future.region_name = start.region_name
    AND future.metric_name = 'zhvi'
    AND DATE_TRUNC('month', future.period_date) = DATE_TRUNC('month', start.period_date + INTERVAL '60 months')
WHERE h.geography_type = 'zip'
  AND h.geography_id = start.region_name
  AND start.metric_name = 'zhvi'
  AND DATE_TRUNC('month', start.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.actual_appreciation_60m IS NULL
  AND h.period_date <= '2020-12-01';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT
  geography_type,
  COUNT(*) as total,
  COUNT(actual_appreciation_12m) as has_12m,
  COUNT(actual_appreciation_24m) as has_24m,
  COUNT(actual_appreciation_36m) as has_36m,
  COUNT(actual_appreciation_60m) as has_60m
FROM propertyiq_scores_history
GROUP BY geography_type
ORDER BY geography_type;
