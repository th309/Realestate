-- Direct ZIP peer group assignment - simplified (no growth component)
-- Format: {price_tier}-{region}-S (stable)
SET statement_timeout = '300000';

-- 2024 batch
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN z.value < 150000 THEN '1'
    WHEN z.value < 300000 THEN '2'
    WHEN z.value < 500000 THEN '3'
    WHEN z.value < 1000000 THEN '4'
    ELSE '5'
  END || '-' ||
  CASE
    WHEN z.state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
    WHEN z.state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
    WHEN z.state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
    ELSE 'WE'
  END || '-S'
FROM zillow_zip z
WHERE h.geography_type = 'zip'
  AND h.geography_id = z.region_name
  AND z.metric_name = 'zhvi'
  AND DATE_TRUNC('month', z.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2024-01-01';

SELECT '2024' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2023 batch
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN z.value < 150000 THEN '1'
    WHEN z.value < 300000 THEN '2'
    WHEN z.value < 500000 THEN '3'
    WHEN z.value < 1000000 THEN '4'
    ELSE '5'
  END || '-' ||
  CASE
    WHEN z.state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
    WHEN z.state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
    WHEN z.state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
    ELSE 'WE'
  END || '-S'
FROM zillow_zip z
WHERE h.geography_type = 'zip'
  AND h.geography_id = z.region_name
  AND z.metric_name = 'zhvi'
  AND DATE_TRUNC('month', z.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2023-01-01' AND h.period_date < '2024-01-01';

SELECT '2023' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2022 batch
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN z.value < 150000 THEN '1'
    WHEN z.value < 300000 THEN '2'
    WHEN z.value < 500000 THEN '3'
    WHEN z.value < 1000000 THEN '4'
    ELSE '5'
  END || '-' ||
  CASE
    WHEN z.state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
    WHEN z.state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
    WHEN z.state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
    ELSE 'WE'
  END || '-S'
FROM zillow_zip z
WHERE h.geography_type = 'zip'
  AND h.geography_id = z.region_name
  AND z.metric_name = 'zhvi'
  AND DATE_TRUNC('month', z.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2022-01-01' AND h.period_date < '2023-01-01';

SELECT '2022' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2021 batch
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN z.value < 150000 THEN '1'
    WHEN z.value < 300000 THEN '2'
    WHEN z.value < 500000 THEN '3'
    WHEN z.value < 1000000 THEN '4'
    ELSE '5'
  END || '-' ||
  CASE
    WHEN z.state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
    WHEN z.state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
    WHEN z.state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
    ELSE 'WE'
  END || '-S'
FROM zillow_zip z
WHERE h.geography_type = 'zip'
  AND h.geography_id = z.region_name
  AND z.metric_name = 'zhvi'
  AND DATE_TRUNC('month', z.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2021-01-01' AND h.period_date < '2022-01-01';

SELECT '2021' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2020 batch
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN z.value < 150000 THEN '1'
    WHEN z.value < 300000 THEN '2'
    WHEN z.value < 500000 THEN '3'
    WHEN z.value < 1000000 THEN '4'
    ELSE '5'
  END || '-' ||
  CASE
    WHEN z.state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
    WHEN z.state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
    WHEN z.state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
    ELSE 'WE'
  END || '-S'
FROM zillow_zip z
WHERE h.geography_type = 'zip'
  AND h.geography_id = z.region_name
  AND z.metric_name = 'zhvi'
  AND DATE_TRUNC('month', z.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2020-01-01' AND h.period_date < '2021-01-01';

SELECT '2020' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2019 batch
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN z.value < 150000 THEN '1'
    WHEN z.value < 300000 THEN '2'
    WHEN z.value < 500000 THEN '3'
    WHEN z.value < 1000000 THEN '4'
    ELSE '5'
  END || '-' ||
  CASE
    WHEN z.state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
    WHEN z.state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
    WHEN z.state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
    ELSE 'WE'
  END || '-S'
FROM zillow_zip z
WHERE h.geography_type = 'zip'
  AND h.geography_id = z.region_name
  AND z.metric_name = 'zhvi'
  AND DATE_TRUNC('month', z.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2019-01-01' AND h.period_date < '2020-01-01';

SELECT '2019' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2018 batch
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN z.value < 150000 THEN '1'
    WHEN z.value < 300000 THEN '2'
    WHEN z.value < 500000 THEN '3'
    WHEN z.value < 1000000 THEN '4'
    ELSE '5'
  END || '-' ||
  CASE
    WHEN z.state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
    WHEN z.state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
    WHEN z.state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
    ELSE 'WE'
  END || '-S'
FROM zillow_zip z
WHERE h.geography_type = 'zip'
  AND h.geography_id = z.region_name
  AND z.metric_name = 'zhvi'
  AND DATE_TRUNC('month', z.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2018-01-01' AND h.period_date < '2019-01-01';

SELECT '2018' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2017 batch
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN z.value < 150000 THEN '1'
    WHEN z.value < 300000 THEN '2'
    WHEN z.value < 500000 THEN '3'
    WHEN z.value < 1000000 THEN '4'
    ELSE '5'
  END || '-' ||
  CASE
    WHEN z.state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
    WHEN z.state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
    WHEN z.state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
    ELSE 'WE'
  END || '-S'
FROM zillow_zip z
WHERE h.geography_type = 'zip'
  AND h.geography_id = z.region_name
  AND z.metric_name = 'zhvi'
  AND DATE_TRUNC('month', z.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2017-01-01' AND h.period_date < '2018-01-01';

SELECT '2017' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2016 batch
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN z.value < 150000 THEN '1'
    WHEN z.value < 300000 THEN '2'
    WHEN z.value < 500000 THEN '3'
    WHEN z.value < 1000000 THEN '4'
    ELSE '5'
  END || '-' ||
  CASE
    WHEN z.state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
    WHEN z.state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
    WHEN z.state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
    ELSE 'WE'
  END || '-S'
FROM zillow_zip z
WHERE h.geography_type = 'zip'
  AND h.geography_id = z.region_name
  AND z.metric_name = 'zhvi'
  AND DATE_TRUNC('month', z.period_date) = DATE_TRUNC('month', h.period_date)
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2016-01-01' AND h.period_date < '2017-01-01';

SELECT '2016' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- Final check
SELECT 'FINAL' as status,
  ROUND(100.0 * COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) / COUNT(*), 1) as peer_pct,
  COUNT(DISTINCT peer_group_id) FILTER (WHERE peer_group_id IS NOT NULL) as unique_groups
FROM propertyiq_scores_history WHERE geography_type = 'zip';
