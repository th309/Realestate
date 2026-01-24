-- Peer Group Assignment via SQL
-- Assigns peer_group_id and parent_geography_id to history records
-- Run each section separately to avoid timeouts

-- ============================================================================
-- STEP 1: Create state-to-region mapping
-- ============================================================================
CREATE TEMP TABLE IF NOT EXISTS state_regions AS
SELECT state_code,
  CASE
    WHEN state_code IN ('CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA') THEN 'NE'
    WHEN state_code IN ('IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI') THEN 'MW'
    WHEN state_code IN ('AL', 'AR', 'DE', 'DC', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV') THEN 'SO'
    ELSE 'WE'
  END as region
FROM (SELECT DISTINCT state_code FROM zillow_zip WHERE state_code IS NOT NULL) s;

SELECT 'State regions created' as status, COUNT(*) as states FROM state_regions;

-- ============================================================================
-- STEP 2: Assign parent_geography_id for ZIPs (ZIP -> Metro via county_fips)
-- ============================================================================
-- First, get the metro (CBSA) for each ZIP via county
UPDATE propertyiq_scores_history h
SET parent_geography_id = zc.cbsa_code
FROM zillow_zip z
JOIN zillow_county zc ON zc.fips_code = z.county_fips AND zc.metric_name = 'zhvi'
WHERE h.geography_type = 'zip'
  AND h.geography_id = z.region_name
  AND z.metric_name = 'zhvi'
  AND h.parent_geography_id IS NULL
  AND z.county_fips IS NOT NULL
  AND zc.cbsa_code IS NOT NULL;

SELECT 'ZIP parent assigned' as status, COUNT(*) as zips_with_parent
FROM propertyiq_scores_history WHERE geography_type = 'zip' AND parent_geography_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Assign parent_geography_id for Counties (County -> State)
-- ============================================================================
UPDATE propertyiq_scores_history h
SET parent_geography_id = zc.state_code
FROM zillow_county zc
WHERE h.geography_type = 'county'
  AND h.geography_id = zc.fips_code
  AND zc.metric_name = 'zhvi'
  AND h.parent_geography_id IS NULL
  AND zc.state_code IS NOT NULL;

SELECT 'County parent assigned' as status, COUNT(*) as counties_with_parent
FROM propertyiq_scores_history WHERE geography_type = 'county' AND parent_geography_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Assign peer_group_id for ZIPs
-- Format: {price_tier}-{region}-{growth}
-- ============================================================================
-- Get latest ZHVI and 1yr appreciation for peer grouping
WITH zip_metrics AS (
  SELECT DISTINCT ON (z.region_name)
    z.region_name,
    z.state_code,
    z.value as current_zhvi,
    sr.region,
    COALESCE(
      (z.value - LAG(z.value) OVER (PARTITION BY z.region_name ORDER BY z.period_date)) / NULLIF(LAG(z.value) OVER (PARTITION BY z.region_name ORDER BY z.period_date), 0),
      0
    ) as yoy_appreciation
  FROM zillow_zip z
  LEFT JOIN state_regions sr ON sr.state_code = z.state_code
  WHERE z.metric_name = 'zhvi'
    AND z.period_date >= '2023-01-01'
  ORDER BY z.region_name, z.period_date DESC
)
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN zm.current_zhvi < 150000 THEN '1'
    WHEN zm.current_zhvi < 300000 THEN '2'
    WHEN zm.current_zhvi < 500000 THEN '3'
    WHEN zm.current_zhvi < 1000000 THEN '4'
    ELSE '5'
  END || '-' || COALESCE(zm.region, 'WE') || '-' ||
  CASE
    WHEN zm.yoy_appreciation < -0.02 THEN 'D'
    WHEN zm.yoy_appreciation > 0.05 THEN 'G'
    ELSE 'S'
  END
FROM zip_metrics zm
WHERE h.geography_type = 'zip'
  AND h.geography_id = zm.region_name
  AND h.peer_group_id IS NULL;

SELECT 'ZIP peer groups assigned' as status,
  COUNT(*) as total_zips,
  COUNT(peer_group_id) as with_peer_group,
  COUNT(DISTINCT peer_group_id) as unique_groups
FROM propertyiq_scores_history WHERE geography_type = 'zip';

-- ============================================================================
-- STEP 5: Assign peer_group_id for Counties
-- ============================================================================
WITH county_metrics AS (
  SELECT DISTINCT ON (c.fips_code)
    c.fips_code,
    c.state_code,
    c.value as current_zhvi,
    sr.region,
    COALESCE(
      (c.value - LAG(c.value) OVER (PARTITION BY c.fips_code ORDER BY c.period_date)) / NULLIF(LAG(c.value) OVER (PARTITION BY c.fips_code ORDER BY c.period_date), 0),
      0
    ) as yoy_appreciation
  FROM zillow_county c
  LEFT JOIN state_regions sr ON sr.state_code = c.state_code
  WHERE c.metric_name = 'zhvi'
    AND c.period_date >= '2023-01-01'
  ORDER BY c.fips_code, c.period_date DESC
)
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN cm.current_zhvi < 150000 THEN '1'
    WHEN cm.current_zhvi < 300000 THEN '2'
    WHEN cm.current_zhvi < 500000 THEN '3'
    WHEN cm.current_zhvi < 1000000 THEN '4'
    ELSE '5'
  END || '-' || COALESCE(cm.region, 'WE') || '-' ||
  CASE
    WHEN cm.yoy_appreciation < -0.02 THEN 'D'
    WHEN cm.yoy_appreciation > 0.05 THEN 'G'
    ELSE 'S'
  END
FROM county_metrics cm
WHERE h.geography_type = 'county'
  AND h.geography_id = cm.fips_code
  AND h.peer_group_id IS NULL;

SELECT 'County peer groups assigned' as status,
  COUNT(*) as total_counties,
  COUNT(peer_group_id) as with_peer_group,
  COUNT(DISTINCT peer_group_id) as unique_groups
FROM propertyiq_scores_history WHERE geography_type = 'county';

-- ============================================================================
-- STEP 6: Assign peer_group_id for Metros
-- ============================================================================
WITH metro_metrics AS (
  SELECT DISTINCT ON (m.cbsa_code)
    m.cbsa_code,
    m.value as current_zhvi,
    COALESCE(
      (m.value - LAG(m.value) OVER (PARTITION BY m.cbsa_code ORDER BY m.period_date)) / NULLIF(LAG(m.value) OVER (PARTITION BY m.cbsa_code ORDER BY m.period_date), 0),
      0
    ) as yoy_appreciation
  FROM zillow_metro m
  WHERE m.metric_name = 'zhvi'
    AND m.period_date >= '2023-01-01'
  ORDER BY m.cbsa_code, m.period_date DESC
)
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN mm.current_zhvi < 150000 THEN '1'
    WHEN mm.current_zhvi < 300000 THEN '2'
    WHEN mm.current_zhvi < 500000 THEN '3'
    WHEN mm.current_zhvi < 1000000 THEN '4'
    ELSE '5'
  END || '-US-' ||
  CASE
    WHEN mm.yoy_appreciation < -0.02 THEN 'D'
    WHEN mm.yoy_appreciation > 0.05 THEN 'G'
    ELSE 'S'
  END
FROM metro_metrics mm
WHERE h.geography_type = 'metro'
  AND h.geography_id = mm.cbsa_code
  AND h.peer_group_id IS NULL;

SELECT 'Metro peer groups assigned' as status,
  COUNT(*) as total_metros,
  COUNT(peer_group_id) as with_peer_group,
  COUNT(DISTINCT peer_group_id) as unique_groups
FROM propertyiq_scores_history WHERE geography_type = 'metro';

-- ============================================================================
-- STEP 7: Assign peer_group_id for States
-- ============================================================================
WITH state_metrics AS (
  SELECT DISTINCT ON (s.state_code)
    s.state_code,
    s.value as current_zhvi,
    sr.region,
    COALESCE(
      (s.value - LAG(s.value) OVER (PARTITION BY s.state_code ORDER BY s.period_date)) / NULLIF(LAG(s.value) OVER (PARTITION BY s.state_code ORDER BY s.period_date), 0),
      0
    ) as yoy_appreciation
  FROM zillow_state s
  LEFT JOIN state_regions sr ON sr.state_code = s.state_code
  WHERE s.metric_name = 'zhvi'
    AND s.period_date >= '2023-01-01'
  ORDER BY s.state_code, s.period_date DESC
)
UPDATE propertyiq_scores_history h
SET peer_group_id =
  CASE
    WHEN sm.current_zhvi < 150000 THEN '1'
    WHEN sm.current_zhvi < 300000 THEN '2'
    WHEN sm.current_zhvi < 500000 THEN '3'
    WHEN sm.current_zhvi < 1000000 THEN '4'
    ELSE '5'
  END || '-' || COALESCE(sm.region, 'US') || '-' ||
  CASE
    WHEN sm.yoy_appreciation < -0.02 THEN 'D'
    WHEN sm.yoy_appreciation > 0.05 THEN 'G'
    ELSE 'S'
  END
FROM state_metrics sm
WHERE h.geography_type = 'state'
  AND h.geography_id = sm.state_code
  AND h.peer_group_id IS NULL;

SELECT 'State peer groups assigned' as status,
  COUNT(*) as total_states,
  COUNT(peer_group_id) as with_peer_group,
  COUNT(DISTINCT peer_group_id) as unique_groups
FROM propertyiq_scores_history WHERE geography_type = 'state';

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================
SELECT geography_type,
  COUNT(*) as total,
  COUNT(peer_group_id) as with_peer_group,
  COUNT(parent_geography_id) as with_parent,
  ROUND(100.0 * COUNT(peer_group_id) / COUNT(*), 1) as peer_pct,
  ROUND(100.0 * COUNT(parent_geography_id) / COUNT(*), 1) as parent_pct
FROM propertyiq_scores_history
GROUP BY geography_type
ORDER BY geography_type;
