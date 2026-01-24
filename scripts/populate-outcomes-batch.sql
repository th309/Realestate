-- Batch Outcome Population - Processes in chunks to avoid timeouts
-- Run each section separately

-- ============================================================================
-- STATE OUTCOMES (smallest dataset - run all at once)
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
  AND h.actual_appreciation_12m IS NULL;

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
  AND h.actual_appreciation_24m IS NULL;

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
  AND h.actual_appreciation_36m IS NULL;

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
  AND h.actual_appreciation_60m IS NULL;

SELECT 'States done' as status, COUNT(*) as with_12m FROM propertyiq_scores_history WHERE geography_type = 'state' AND actual_appreciation_12m IS NOT NULL;
