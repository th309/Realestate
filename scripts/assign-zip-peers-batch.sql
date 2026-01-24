-- Batch ZIP peer group assignment by year
-- The temp_zip_peers table should already exist from the previous run

SET statement_timeout = '300000';

-- Check if temp table exists, recreate if needed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'temp_zip_peers') THEN
    CREATE TEMP TABLE temp_zip_peers AS
    WITH zip_latest AS (
      SELECT DISTINCT ON (region_name)
        region_name,
        state_code,
        value as current_zhvi
      FROM zillow_zip
      WHERE metric_name = 'zhvi' AND period_date >= '2024-01-01'
      ORDER BY region_name, period_date DESC
    ),
    zip_prev AS (
      SELECT DISTINCT ON (region_name)
        region_name,
        value as prev_zhvi
      FROM zillow_zip
      WHERE metric_name = 'zhvi' AND period_date >= '2023-01-01' AND period_date < '2024-01-01'
      ORDER BY region_name, period_date DESC
    ),
    state_regions AS (
      SELECT state_code,
        CASE
          WHEN state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
          WHEN state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
          WHEN state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
          ELSE 'WE'
        END as region
      FROM (SELECT DISTINCT state_code FROM zillow_state WHERE state_code IS NOT NULL) s
    )
    SELECT
      zl.region_name,
      CASE
        WHEN zl.current_zhvi < 150000 THEN '1'
        WHEN zl.current_zhvi < 300000 THEN '2'
        WHEN zl.current_zhvi < 500000 THEN '3'
        WHEN zl.current_zhvi < 1000000 THEN '4'
        ELSE '5'
      END || '-' || COALESCE(sr.region, 'WE') || '-' ||
      CASE
        WHEN zp.prev_zhvi IS NULL THEN 'S'
        WHEN ((zl.current_zhvi - zp.prev_zhvi) / NULLIF(zp.prev_zhvi, 0)) < -0.02 THEN 'D'
        WHEN ((zl.current_zhvi - zp.prev_zhvi) / NULLIF(zp.prev_zhvi, 0)) > 0.05 THEN 'G'
        ELSE 'S'
      END as peer_group_id
    FROM zip_latest zl
    LEFT JOIN zip_prev zp ON zp.region_name = zl.region_name
    LEFT JOIN state_regions sr ON sr.state_code = zl.state_code;

    CREATE INDEX ON temp_zip_peers(region_name);
  END IF;
END $$;

SELECT 'Temp table ready' as status, COUNT(*) as zips FROM temp_zip_peers;

-- 2024
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM temp_zip_peers zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2024-01-01';

SELECT '2024 done' as batch, COUNT(*) as with_peer
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND peer_group_id IS NOT NULL;

-- 2023
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM temp_zip_peers zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2023-01-01' AND h.period_date < '2024-01-01';

SELECT '2023 done' as batch, COUNT(*) as with_peer
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND peer_group_id IS NOT NULL;

-- 2022
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM temp_zip_peers zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2022-01-01' AND h.period_date < '2023-01-01';

SELECT '2022 done' as batch, COUNT(*) as with_peer
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND peer_group_id IS NOT NULL;

-- 2021
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM temp_zip_peers zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2021-01-01' AND h.period_date < '2022-01-01';

SELECT '2021 done' as batch, COUNT(*) as with_peer
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND peer_group_id IS NOT NULL;

-- 2020
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM temp_zip_peers zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2020-01-01' AND h.period_date < '2021-01-01';

SELECT '2020 done' as batch, COUNT(*) as with_peer
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND peer_group_id IS NOT NULL;

-- 2019
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM temp_zip_peers zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2019-01-01' AND h.period_date < '2020-01-01';

SELECT '2019 done' as batch, COUNT(*) as with_peer
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND peer_group_id IS NOT NULL;

-- 2018
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM temp_zip_peers zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2018-01-01' AND h.period_date < '2019-01-01';

SELECT '2018 done' as batch, COUNT(*) as with_peer
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND peer_group_id IS NOT NULL;

-- 2017
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM temp_zip_peers zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2017-01-01' AND h.period_date < '2018-01-01';

SELECT '2017 done' as batch, COUNT(*) as with_peer
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND peer_group_id IS NOT NULL;

-- 2016
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM temp_zip_peers zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2016-01-01' AND h.period_date < '2017-01-01';

SELECT '2016 done' as batch, COUNT(*) as with_peer
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND peer_group_id IS NOT NULL;

-- Final check
SELECT 'FINAL' as status,
  ROUND(100.0 * COUNT(peer_group_id) / COUNT(*), 1) as peer_pct,
  COUNT(DISTINCT peer_group_id) as unique_groups
FROM propertyiq_scores_history WHERE geography_type = 'zip';
