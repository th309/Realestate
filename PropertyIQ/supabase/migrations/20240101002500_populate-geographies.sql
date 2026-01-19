-- Migration 031: Populate Geographies Table
-- Pulls data from geography_crosswalk to create unified geography reference
-- Includes all Zillow ID mappings for data joins

BEGIN;

-- ============================================================================
-- SECTION 1: Insert States
-- ============================================================================

INSERT INTO geographies (
  geography_id,
  geography_type,
  name,
  name_short,
  state_code,
  state_name,
  state_fips,
  zillow_state_region_id
)
SELECT DISTINCT ON (state_abbrev)
  state_abbrev as geography_id,
  'state' as geography_type,
  state_name as name,
  state_abbrev as name_short,
  state_abbrev as state_code,
  state_name,
  state_fips,
  zillow_state_region_id
FROM geography_crosswalk
WHERE state_abbrev IS NOT NULL
ORDER BY state_abbrev, zillow_state_region_id DESC NULLS LAST
ON CONFLICT (geography_id, geography_type) DO UPDATE SET
  name = EXCLUDED.name,
  state_name = EXCLUDED.state_name,
  state_fips = EXCLUDED.state_fips,
  zillow_state_region_id = EXCLUDED.zillow_state_region_id,
  updated_at = NOW();

-- ============================================================================
-- SECTION 2: Insert Counties
-- ============================================================================

INSERT INTO geographies (
  geography_id,
  geography_type,
  name,
  name_short,
  state_code,
  state_name,
  state_fips,
  fips_code,
  county_name,
  cbsa_code,
  cbsa_name,
  cbsa_type,
  zillow_county_region_id,
  zillow_state_region_id,
  zillow_metro_region_id,
  zillow_metro_name,
  population
)
SELECT DISTINCT ON (county_fips)
  county_fips as geography_id,
  'county' as geography_type,
  COALESCE(county_name, 'County ' || county_fips) || ', ' || COALESCE(state_abbrev, '') as name,
  COALESCE(county_name, 'County ' || county_fips) as name_short,
  state_abbrev as state_code,
  state_name,
  state_fips,
  county_fips as fips_code,
  COALESCE(county_name, 'County ' || county_fips) as county_name,
  cbsa_code,
  cbsa_name,
  cbsa_type,
  zillow_county_region_id,
  zillow_state_region_id,
  zillow_metro_region_id,
  zillow_metro_name,
  county_population as population
FROM geography_crosswalk
WHERE county_fips IS NOT NULL
ORDER BY county_fips, county_population DESC NULLS LAST
ON CONFLICT (geography_id, geography_type) DO UPDATE SET
  name = EXCLUDED.name,
  name_short = EXCLUDED.name_short,
  state_code = EXCLUDED.state_code,
  state_name = EXCLUDED.state_name,
  state_fips = EXCLUDED.state_fips,
  fips_code = EXCLUDED.fips_code,
  county_name = EXCLUDED.county_name,
  cbsa_code = EXCLUDED.cbsa_code,
  cbsa_name = EXCLUDED.cbsa_name,
  cbsa_type = EXCLUDED.cbsa_type,
  zillow_county_region_id = EXCLUDED.zillow_county_region_id,
  zillow_state_region_id = EXCLUDED.zillow_state_region_id,
  zillow_metro_region_id = EXCLUDED.zillow_metro_region_id,
  zillow_metro_name = EXCLUDED.zillow_metro_name,
  population = EXCLUDED.population,
  updated_at = NOW();

-- ============================================================================
-- SECTION 3: Insert Metros (CBSAs)
-- ============================================================================

INSERT INTO geographies (
  geography_id,
  geography_type,
  name,
  name_short,
  cbsa_code,
  cbsa_name,
  cbsa_type,
  zillow_metro_region_id,
  zillow_metro_name,
  population
)
SELECT DISTINCT ON (cbsa_code)
  cbsa_code as geography_id,
  'metro' as geography_type,
  COALESCE(cbsa_name, 'Metro ' || cbsa_code) as name,
  CASE
    WHEN cbsa_name IS NULL THEN 'Metro ' || cbsa_code
    WHEN position('-' in cbsa_name) > 0 THEN split_part(cbsa_name, '-', 1)
    WHEN position(',' in cbsa_name) > 0 THEN split_part(cbsa_name, ',', 1)
    ELSE cbsa_name
  END as name_short,
  cbsa_code,
  cbsa_name,
  cbsa_type,
  zillow_metro_region_id,
  zillow_metro_name,
  cbsa_population as population
FROM geography_crosswalk
WHERE cbsa_code IS NOT NULL AND cbsa_code != ''
ORDER BY cbsa_code, cbsa_population DESC NULLS LAST
ON CONFLICT (geography_id, geography_type) DO UPDATE SET
  name = EXCLUDED.name,
  name_short = EXCLUDED.name_short,
  cbsa_name = EXCLUDED.cbsa_name,
  cbsa_type = EXCLUDED.cbsa_type,
  zillow_metro_region_id = EXCLUDED.zillow_metro_region_id,
  zillow_metro_name = EXCLUDED.zillow_metro_name,
  population = EXCLUDED.population,
  updated_at = NOW();

-- ============================================================================
-- SECTION 4: Insert ZIP Codes
-- ============================================================================

INSERT INTO geographies (
  geography_id,
  geography_type,
  name,
  name_short,
  state_code,
  state_name,
  state_fips,
  fips_code,
  county_name,
  parent_county_id,
  cbsa_code,
  cbsa_name,
  cbsa_type,
  parent_metro_id,
  zillow_state_region_id,
  zillow_county_region_id,
  zillow_metro_region_id,
  zillow_metro_name
)
SELECT
  zip_code as geography_id,
  'zip' as geography_type,
  COALESCE(zip_default_city, '') || CASE WHEN zip_default_city IS NOT NULL AND zip_default_state IS NOT NULL THEN ', ' ELSE '' END || COALESCE(zip_default_state, '') || ' ' || zip_code as name,
  zip_code as name_short,
  state_abbrev as state_code,
  state_name,
  state_fips,
  county_fips as fips_code,
  county_name,
  county_fips as parent_county_id,
  cbsa_code,
  cbsa_name,
  cbsa_type,
  cbsa_code as parent_metro_id,
  zillow_state_region_id,
  zillow_county_region_id,
  zillow_metro_region_id,
  zillow_metro_name
FROM geography_crosswalk
WHERE zip_code IS NOT NULL
ON CONFLICT (geography_id, geography_type) DO UPDATE SET
  name = EXCLUDED.name,
  state_code = EXCLUDED.state_code,
  state_name = EXCLUDED.state_name,
  state_fips = EXCLUDED.state_fips,
  fips_code = EXCLUDED.fips_code,
  county_name = EXCLUDED.county_name,
  parent_county_id = EXCLUDED.parent_county_id,
  cbsa_code = EXCLUDED.cbsa_code,
  cbsa_name = EXCLUDED.cbsa_name,
  cbsa_type = EXCLUDED.cbsa_type,
  parent_metro_id = EXCLUDED.parent_metro_id,
  zillow_state_region_id = EXCLUDED.zillow_state_region_id,
  zillow_county_region_id = EXCLUDED.zillow_county_region_id,
  zillow_metro_region_id = EXCLUDED.zillow_metro_region_id,
  zillow_metro_name = EXCLUDED.zillow_metro_name,
  updated_at = NOW();

-- ============================================================================
-- SECTION 5: Add National geography
-- ============================================================================

INSERT INTO geographies (
  geography_id,
  geography_type,
  name,
  name_short
)
VALUES (
  'US',
  'national',
  'United States',
  'US'
)
ON CONFLICT (geography_id, geography_type) DO NOTHING;

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================

SELECT
  geography_type,
  COUNT(*) as count,
  COUNT(zillow_state_region_id) as has_state_zillow_id,
  COUNT(zillow_county_region_id) as has_county_zillow_id,
  COUNT(zillow_metro_region_id) as has_metro_zillow_id
FROM geographies
GROUP BY geography_type
ORDER BY
  CASE geography_type
    WHEN 'national' THEN 1
    WHEN 'state' THEN 2
    WHEN 'metro' THEN 3
    WHEN 'county' THEN 4
    WHEN 'zip' THEN 5
    ELSE 6
  END;
