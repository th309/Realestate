-- Migration 033: Migrate Zillow Data to New Long-Format Tables
-- Moves data from old zillow_zhvi, zillow_zori, zillow_inventory tables
-- to new zillow_metro, zillow_county, zillow_zip, zillow_state tables

-- ============================================================================
-- SECTION 1: Migrate Metro Data
-- ============================================================================

-- ZHVI Metro
INSERT INTO zillow_metro (region_id, region_name, state_code, cbsa_code, period_date, metric_name, value)
SELECT DISTINCT ON (z.region_id::integer, z.date)
  z.region_id::integer,
  COALESCE(g.name, 'Metro ' || z.region_id) as region_name,
  NULL as state_code,
  g.cbsa_code,
  z.date as period_date,
  'zhvi' as metric_name,
  z.value
FROM zillow_zhvi z
LEFT JOIN geographies g ON g.zillow_metro_region_id = z.region_id::integer AND g.geography_type = 'metro'
WHERE LOWER(z.geography) = 'metro'
  AND z.value IS NOT NULL
ORDER BY z.region_id::integer, z.date, z.created_at DESC
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ZHVI YoY Metro
INSERT INTO zillow_metro (region_id, region_name, state_code, cbsa_code, period_date, metric_name, value)
SELECT DISTINCT ON (z.region_id::integer, z.date)
  z.region_id::integer,
  COALESCE(g.name, 'Metro ' || z.region_id) as region_name,
  NULL as state_code,
  g.cbsa_code,
  z.date as period_date,
  'zhvi_yoy' as metric_name,
  z.yoy_growth
FROM zillow_zhvi z
LEFT JOIN geographies g ON g.zillow_metro_region_id = z.region_id::integer AND g.geography_type = 'metro'
WHERE LOWER(z.geography) = 'metro'
  AND z.yoy_growth IS NOT NULL
ORDER BY z.region_id::integer, z.date, z.created_at DESC
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ZORI Metro
INSERT INTO zillow_metro (region_id, region_name, state_code, cbsa_code, period_date, metric_name, value)
SELECT DISTINCT ON (z.region_id::integer, z.date)
  z.region_id::integer,
  COALESCE(g.name, 'Metro ' || z.region_id) as region_name,
  NULL as state_code,
  g.cbsa_code,
  z.date as period_date,
  'zori' as metric_name,
  z.value
FROM zillow_zori z
LEFT JOIN geographies g ON g.zillow_metro_region_id = z.region_id::integer AND g.geography_type = 'metro'
WHERE LOWER(z.geography) = 'metro'
  AND z.value IS NOT NULL
ORDER BY z.region_id::integer, z.date, z.created_at DESC
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Inventory Metro
INSERT INTO zillow_metro (region_id, region_name, state_code, cbsa_code, period_date, metric_name, value)
SELECT DISTINCT ON (z.region_id::integer, z.date)
  z.region_id::integer,
  COALESCE(g.name, 'Metro ' || z.region_id) as region_name,
  NULL as state_code,
  g.cbsa_code,
  z.date as period_date,
  'inventory' as metric_name,
  z.inventory_count
FROM zillow_inventory z
LEFT JOIN geographies g ON g.zillow_metro_region_id = z.region_id::integer AND g.geography_type = 'metro'
WHERE LOWER(z.geography) = 'metro'
  AND z.inventory_count IS NOT NULL
ORDER BY z.region_id::integer, z.date, z.created_at DESC
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ============================================================================
-- SECTION 2: Migrate County Data
-- ============================================================================

-- ZHVI County
INSERT INTO zillow_county (region_id, region_name, state_code, fips_code, period_date, metric_name, value)
SELECT DISTINCT ON (z.region_id::integer, z.date)
  z.region_id::integer,
  COALESCE(g.name, 'County ' || z.region_id) as region_name,
  g.state_code,
  g.fips_code,
  z.date as period_date,
  'zhvi' as metric_name,
  z.value
FROM zillow_zhvi z
LEFT JOIN geographies g ON g.zillow_county_region_id = z.region_id::integer AND g.geography_type = 'county'
WHERE LOWER(z.geography) = 'county'
  AND z.value IS NOT NULL
ORDER BY z.region_id::integer, z.date, z.created_at DESC
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ZHVI YoY County
INSERT INTO zillow_county (region_id, region_name, state_code, fips_code, period_date, metric_name, value)
SELECT DISTINCT ON (z.region_id::integer, z.date)
  z.region_id::integer,
  COALESCE(g.name, 'County ' || z.region_id) as region_name,
  g.state_code,
  g.fips_code,
  z.date as period_date,
  'zhvi_yoy' as metric_name,
  z.yoy_growth
FROM zillow_zhvi z
LEFT JOIN geographies g ON g.zillow_county_region_id = z.region_id::integer AND g.geography_type = 'county'
WHERE LOWER(z.geography) = 'county'
  AND z.yoy_growth IS NOT NULL
ORDER BY z.region_id::integer, z.date, z.created_at DESC
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ZORI County
INSERT INTO zillow_county (region_id, region_name, state_code, fips_code, period_date, metric_name, value)
SELECT DISTINCT ON (z.region_id::integer, z.date)
  z.region_id::integer,
  COALESCE(g.name, 'County ' || z.region_id) as region_name,
  g.state_code,
  g.fips_code,
  z.date as period_date,
  'zori' as metric_name,
  z.value
FROM zillow_zori z
LEFT JOIN geographies g ON g.zillow_county_region_id = z.region_id::integer AND g.geography_type = 'county'
WHERE LOWER(z.geography) = 'county'
  AND z.value IS NOT NULL
ORDER BY z.region_id::integer, z.date, z.created_at DESC
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Inventory County
INSERT INTO zillow_county (region_id, region_name, state_code, fips_code, period_date, metric_name, value)
SELECT DISTINCT ON (z.region_id::integer, z.date)
  z.region_id::integer,
  COALESCE(g.name, 'County ' || z.region_id) as region_name,
  g.state_code,
  g.fips_code,
  z.date as period_date,
  'inventory' as metric_name,
  z.inventory_count
FROM zillow_inventory z
LEFT JOIN geographies g ON g.zillow_county_region_id = z.region_id::integer AND g.geography_type = 'county'
WHERE LOWER(z.geography) = 'county'
  AND z.inventory_count IS NOT NULL
ORDER BY z.region_id::integer, z.date, z.created_at DESC
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ============================================================================
-- SECTION 3: Migrate State Data
-- ============================================================================

-- ZHVI State
INSERT INTO zillow_state (region_id, region_name, state_code, period_date, metric_name, value)
SELECT DISTINCT ON (z.region_id::integer, z.date)
  z.region_id::integer,
  COALESCE(g.name, 'State ' || z.region_id) as region_name,
  COALESCE(g.state_code, '') as state_code,
  z.date as period_date,
  'zhvi' as metric_name,
  z.value
FROM zillow_zhvi z
LEFT JOIN geographies g ON g.zillow_state_region_id = z.region_id::integer AND g.geography_type = 'state'
WHERE LOWER(z.geography) = 'state'
  AND z.value IS NOT NULL
ORDER BY z.region_id::integer, z.date, z.created_at DESC
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ZHVI YoY State
INSERT INTO zillow_state (region_id, region_name, state_code, period_date, metric_name, value)
SELECT DISTINCT ON (z.region_id::integer, z.date)
  z.region_id::integer,
  COALESCE(g.name, 'State ' || z.region_id) as region_name,
  COALESCE(g.state_code, '') as state_code,
  z.date as period_date,
  'zhvi_yoy' as metric_name,
  z.yoy_growth
FROM zillow_zhvi z
LEFT JOIN geographies g ON g.zillow_state_region_id = z.region_id::integer AND g.geography_type = 'state'
WHERE LOWER(z.geography) = 'state'
  AND z.yoy_growth IS NOT NULL
ORDER BY z.region_id::integer, z.date, z.created_at DESC
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ZORI State
INSERT INTO zillow_state (region_id, region_name, state_code, period_date, metric_name, value)
SELECT DISTINCT ON (z.region_id::integer, z.date)
  z.region_id::integer,
  COALESCE(g.name, 'State ' || z.region_id) as region_name,
  COALESCE(g.state_code, '') as state_code,
  z.date as period_date,
  'zori' as metric_name,
  z.value
FROM zillow_zori z
LEFT JOIN geographies g ON g.zillow_state_region_id = z.region_id::integer AND g.geography_type = 'state'
WHERE LOWER(z.geography) = 'state'
  AND z.value IS NOT NULL
ORDER BY z.region_id::integer, z.date, z.created_at DESC
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Inventory State
INSERT INTO zillow_state (region_id, region_name, state_code, period_date, metric_name, value)
SELECT DISTINCT ON (z.region_id::integer, z.date)
  z.region_id::integer,
  COALESCE(g.name, 'State ' || z.region_id) as region_name,
  COALESCE(g.state_code, '') as state_code,
  z.date as period_date,
  'inventory' as metric_name,
  z.inventory_count
FROM zillow_inventory z
LEFT JOIN geographies g ON g.zillow_state_region_id = z.region_id::integer AND g.geography_type = 'state'
WHERE LOWER(z.geography) = 'state'
  AND z.inventory_count IS NOT NULL
ORDER BY z.region_id::integer, z.date, z.created_at DESC
ON CONFLICT (region_id, period_date, metric_name) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 'zillow_metro' as table_name, COUNT(*) as rows, COUNT(DISTINCT region_id) as regions, COUNT(DISTINCT metric_name) as metrics FROM zillow_metro
UNION ALL
SELECT 'zillow_county', COUNT(*), COUNT(DISTINCT region_id), COUNT(DISTINCT metric_name) FROM zillow_county
UNION ALL
SELECT 'zillow_state', COUNT(*), COUNT(DISTINCT region_id), COUNT(DISTINCT metric_name) FROM zillow_state
ORDER BY table_name;
