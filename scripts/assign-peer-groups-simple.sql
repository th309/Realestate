-- Simplified Peer Group Assignment
-- Assigns peer_group_id based on: price tier + region + growth trend
-- Run with: powershell -ExecutionPolicy Bypass -File scripts/run-peer-sql.ps1

SET statement_timeout = '300000';

-- ============================================================================
-- STEP 1: Create state-to-region mapping
-- ============================================================================
DROP TABLE IF EXISTS temp_state_regions;
CREATE TEMP TABLE temp_state_regions AS
SELECT state_code,
  CASE
    WHEN state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
    WHEN state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
    WHEN state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
    ELSE 'WE'
  END as region
FROM (SELECT DISTINCT state_code FROM zillow_state WHERE state_code IS NOT NULL) s;

SELECT 'Step 1: State regions' as step, COUNT(*) as cnt FROM temp_state_regions;

-- ============================================================================
-- STEP 2: Assign parent_geography_id - ZIP -> State (simpler approach)
-- ============================================================================
UPDATE propertyiq_scores_history h
SET parent_geography_id = z.state_code
FROM zillow_zip z
WHERE h.geography_type = 'zip'
  AND h.geography_id = z.region_name
  AND z.metric_name = 'zhvi'
  AND h.parent_geography_id IS NULL
  AND z.state_code IS NOT NULL
  AND h.period_date >= '2022-01-01';

SELECT 'Step 2a: ZIP parents (2022+)' as step, COUNT(*) as updated
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND parent_geography_id IS NOT NULL;

-- Do earlier years
UPDATE propertyiq_scores_history h
SET parent_geography_id = z.state_code
FROM zillow_zip z
WHERE h.geography_type = 'zip'
  AND h.geography_id = z.region_name
  AND z.metric_name = 'zhvi'
  AND h.parent_geography_id IS NULL
  AND z.state_code IS NOT NULL
  AND h.period_date < '2022-01-01';

SELECT 'Step 2b: ZIP parents (all)' as step, COUNT(*) as total_with_parent
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND parent_geography_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Assign parent_geography_id for Counties -> State
-- ============================================================================
UPDATE propertyiq_scores_history h
SET parent_geography_id = c.state_code
FROM zillow_county c
WHERE h.geography_type = 'county'
  AND h.geography_id = c.fips_code
  AND c.metric_name = 'zhvi'
  AND h.parent_geography_id IS NULL
  AND c.state_code IS NOT NULL;

SELECT 'Step 3: County parents' as step, COUNT(*) as total_with_parent
FROM propertyiq_scores_history WHERE geography_type = 'county' AND parent_geography_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Build ZIP peer group lookup
-- ============================================================================
DROP TABLE IF EXISTS temp_zip_peers;
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
LEFT JOIN temp_state_regions sr ON sr.state_code = zl.state_code;

CREATE INDEX ON temp_zip_peers(region_name);

SELECT 'Step 4: ZIP peer lookup' as step, COUNT(*) as zips, COUNT(DISTINCT peer_group_id) as groups
FROM temp_zip_peers;

-- ============================================================================
-- STEP 5: Assign ZIP peer_group_id (batch by year)
-- ============================================================================
UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM temp_zip_peers zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2023-01-01';

SELECT 'Step 5a: ZIP peers (2023+)' as step, COUNT(*) as with_peer
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND peer_group_id IS NOT NULL;

UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM temp_zip_peers zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL
  AND h.period_date >= '2020-01-01' AND h.period_date < '2023-01-01';

UPDATE propertyiq_scores_history h
SET peer_group_id = zp.peer_group_id
FROM temp_zip_peers zp
WHERE h.geography_type = 'zip'
  AND h.geography_id = zp.region_name
  AND h.peer_group_id IS NULL;

SELECT 'Step 5b: ZIP peers (all)' as step, COUNT(*) as total_with_peer
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND peer_group_id IS NOT NULL;

-- ============================================================================
-- STEP 6: Build County peer group lookup
-- ============================================================================
DROP TABLE IF EXISTS temp_county_peers;
CREATE TEMP TABLE temp_county_peers AS
WITH county_latest AS (
  SELECT DISTINCT ON (fips_code)
    fips_code,
    state_code,
    value as current_zhvi
  FROM zillow_county
  WHERE metric_name = 'zhvi' AND period_date >= '2024-01-01'
  ORDER BY fips_code, period_date DESC
),
county_prev AS (
  SELECT DISTINCT ON (fips_code)
    fips_code,
    value as prev_zhvi
  FROM zillow_county
  WHERE metric_name = 'zhvi' AND period_date >= '2023-01-01' AND period_date < '2024-01-01'
  ORDER BY fips_code, period_date DESC
)
SELECT
  cl.fips_code,
  CASE
    WHEN cl.current_zhvi < 150000 THEN '1'
    WHEN cl.current_zhvi < 300000 THEN '2'
    WHEN cl.current_zhvi < 500000 THEN '3'
    WHEN cl.current_zhvi < 1000000 THEN '4'
    ELSE '5'
  END || '-' || COALESCE(sr.region, 'WE') || '-' ||
  CASE
    WHEN cp.prev_zhvi IS NULL THEN 'S'
    WHEN ((cl.current_zhvi - cp.prev_zhvi) / NULLIF(cp.prev_zhvi, 0)) < -0.02 THEN 'D'
    WHEN ((cl.current_zhvi - cp.prev_zhvi) / NULLIF(cp.prev_zhvi, 0)) > 0.05 THEN 'G'
    ELSE 'S'
  END as peer_group_id
FROM county_latest cl
LEFT JOIN county_prev cp ON cp.fips_code = cl.fips_code
LEFT JOIN temp_state_regions sr ON sr.state_code = cl.state_code;

CREATE INDEX ON temp_county_peers(fips_code);

SELECT 'Step 6: County peer lookup' as step, COUNT(*) as counties, COUNT(DISTINCT peer_group_id) as groups
FROM temp_county_peers;

-- ============================================================================
-- STEP 7: Assign County peer_group_id
-- ============================================================================
UPDATE propertyiq_scores_history h
SET peer_group_id = cp.peer_group_id
FROM temp_county_peers cp
WHERE h.geography_type = 'county'
  AND h.geography_id = cp.fips_code
  AND h.peer_group_id IS NULL;

SELECT 'Step 7: County peers' as step, COUNT(*) as total_with_peer
FROM propertyiq_scores_history WHERE geography_type = 'county' AND peer_group_id IS NOT NULL;

-- ============================================================================
-- STEP 8: Build Metro peer group lookup
-- ============================================================================
DROP TABLE IF EXISTS temp_metro_peers;
CREATE TEMP TABLE temp_metro_peers AS
WITH metro_latest AS (
  SELECT DISTINCT ON (cbsa_code)
    cbsa_code,
    value as current_zhvi
  FROM zillow_metro
  WHERE metric_name = 'zhvi' AND period_date >= '2024-01-01'
  ORDER BY cbsa_code, period_date DESC
),
metro_prev AS (
  SELECT DISTINCT ON (cbsa_code)
    cbsa_code,
    value as prev_zhvi
  FROM zillow_metro
  WHERE metric_name = 'zhvi' AND period_date >= '2023-01-01' AND period_date < '2024-01-01'
  ORDER BY cbsa_code, period_date DESC
)
SELECT
  ml.cbsa_code,
  CASE
    WHEN ml.current_zhvi < 150000 THEN '1'
    WHEN ml.current_zhvi < 300000 THEN '2'
    WHEN ml.current_zhvi < 500000 THEN '3'
    WHEN ml.current_zhvi < 1000000 THEN '4'
    ELSE '5'
  END || '-US-' ||
  CASE
    WHEN mp.prev_zhvi IS NULL THEN 'S'
    WHEN ((ml.current_zhvi - mp.prev_zhvi) / NULLIF(mp.prev_zhvi, 0)) < -0.02 THEN 'D'
    WHEN ((ml.current_zhvi - mp.prev_zhvi) / NULLIF(mp.prev_zhvi, 0)) > 0.05 THEN 'G'
    ELSE 'S'
  END as peer_group_id
FROM metro_latest ml
LEFT JOIN metro_prev mp ON mp.cbsa_code = ml.cbsa_code;

CREATE INDEX ON temp_metro_peers(cbsa_code);

SELECT 'Step 8: Metro peer lookup' as step, COUNT(*) as metros, COUNT(DISTINCT peer_group_id) as groups
FROM temp_metro_peers;

-- ============================================================================
-- STEP 9: Assign Metro peer_group_id
-- ============================================================================
UPDATE propertyiq_scores_history h
SET peer_group_id = mp.peer_group_id
FROM temp_metro_peers mp
WHERE h.geography_type = 'metro'
  AND h.geography_id = mp.cbsa_code
  AND h.peer_group_id IS NULL;

SELECT 'Step 9: Metro peers' as step, COUNT(*) as total_with_peer
FROM propertyiq_scores_history WHERE geography_type = 'metro' AND peer_group_id IS NOT NULL;

-- ============================================================================
-- STEP 10: Build State peer group lookup
-- ============================================================================
DROP TABLE IF EXISTS temp_state_peers;
CREATE TEMP TABLE temp_state_peers AS
WITH state_latest AS (
  SELECT DISTINCT ON (state_code)
    state_code,
    value as current_zhvi
  FROM zillow_state
  WHERE metric_name = 'zhvi' AND period_date >= '2024-01-01'
  ORDER BY state_code, period_date DESC
),
state_prev AS (
  SELECT DISTINCT ON (state_code)
    state_code,
    value as prev_zhvi
  FROM zillow_state
  WHERE metric_name = 'zhvi' AND period_date >= '2023-01-01' AND period_date < '2024-01-01'
  ORDER BY state_code, period_date DESC
)
SELECT
  sl.state_code,
  CASE
    WHEN sl.current_zhvi < 150000 THEN '1'
    WHEN sl.current_zhvi < 300000 THEN '2'
    WHEN sl.current_zhvi < 500000 THEN '3'
    WHEN sl.current_zhvi < 1000000 THEN '4'
    ELSE '5'
  END || '-' || COALESCE(sr.region, 'US') || '-' ||
  CASE
    WHEN sp.prev_zhvi IS NULL THEN 'S'
    WHEN ((sl.current_zhvi - sp.prev_zhvi) / NULLIF(sp.prev_zhvi, 0)) < -0.02 THEN 'D'
    WHEN ((sl.current_zhvi - sp.prev_zhvi) / NULLIF(sp.prev_zhvi, 0)) > 0.05 THEN 'G'
    ELSE 'S'
  END as peer_group_id
FROM state_latest sl
LEFT JOIN state_prev sp ON sp.state_code = sl.state_code
LEFT JOIN temp_state_regions sr ON sr.state_code = sl.state_code;

SELECT 'Step 10: State peer lookup' as step, COUNT(*) as states, COUNT(DISTINCT peer_group_id) as groups
FROM temp_state_peers;

-- ============================================================================
-- STEP 11: Assign State peer_group_id
-- ============================================================================
UPDATE propertyiq_scores_history h
SET peer_group_id = sp.peer_group_id
FROM temp_state_peers sp
WHERE h.geography_type = 'state'
  AND h.geography_id = sp.state_code
  AND h.peer_group_id IS NULL;

SELECT 'Step 11: State peers' as step, COUNT(*) as total_with_peer
FROM propertyiq_scores_history WHERE geography_type = 'state' AND peer_group_id IS NOT NULL;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================
SELECT 'FINAL' as step, geography_type,
  COUNT(*) as total,
  COUNT(peer_group_id) as with_peer,
  COUNT(parent_geography_id) as with_parent,
  ROUND(100.0 * COUNT(peer_group_id) / COUNT(*), 1) as peer_pct
FROM propertyiq_scores_history
GROUP BY geography_type
ORDER BY geography_type;
