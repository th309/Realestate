-- Batch update ZIP peer groups using the persistent lookup table
SET statement_timeout = '300000';

-- 2025
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM zip_peer_lookup zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2025-01-01';

SELECT '2025' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2024
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM zip_peer_lookup zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2024-01-01' AND h.period_date < '2025-01-01';

SELECT '2024' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2023
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM zip_peer_lookup zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2023-01-01' AND h.period_date < '2024-01-01';

SELECT '2023' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2022
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM zip_peer_lookup zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2022-01-01' AND h.period_date < '2023-01-01';

SELECT '2022' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2021
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM zip_peer_lookup zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2021-01-01' AND h.period_date < '2022-01-01';

SELECT '2021' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2020
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM zip_peer_lookup zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2020-01-01' AND h.period_date < '2021-01-01';

SELECT '2020' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2019
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM zip_peer_lookup zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2019-01-01' AND h.period_date < '2020-01-01';

SELECT '2019' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2018
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM zip_peer_lookup zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2018-01-01' AND h.period_date < '2019-01-01';

SELECT '2018' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2017
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM zip_peer_lookup zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2017-01-01' AND h.period_date < '2018-01-01';

SELECT '2017' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- 2016
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM zip_peer_lookup zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2016-01-01' AND h.period_date < '2017-01-01';

SELECT '2016' as batch, COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) as with_peer,
  COUNT(*) as total FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- Final
SELECT 'FINAL' as status,
  ROUND(100.0 * COUNT(*) FILTER (WHERE peer_group_id IS NOT NULL) / COUNT(*), 1) as peer_pct,
  COUNT(DISTINCT peer_group_id) FILTER (WHERE peer_group_id IS NOT NULL) as unique_groups
FROM propertyiq_scores_history WHERE geography_type = 'zip';
