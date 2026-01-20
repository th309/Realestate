-- Migration: Populate Geography Inheritance Table
-- Description: Populates inheritance chains from geography_crosswalk
-- Date: 2026-01-20

BEGIN;

-- ============================================================================
-- SECTION 1: Insert National geography
-- ============================================================================

INSERT INTO geography_inheritance (
  geography_id,
  geography_type,
  state_fips,
  parent_state_fips
)
VALUES (
  'national',
  'national',
  NULL,
  NULL
)
ON CONFLICT (geography_id) DO NOTHING;

-- ============================================================================
-- SECTION 2: Insert States
-- ============================================================================

INSERT INTO geography_inheritance (
  geography_id,
  geography_type,
  state_fips,
  parent_state_fips
)
SELECT DISTINCT ON (state_fips)
  state_fips as geography_id,
  'state' as geography_type,
  state_fips,
  NULL as parent_state_fips  -- States don't inherit from other states
FROM geography_crosswalk
WHERE state_fips IS NOT NULL AND state_fips != ''
ORDER BY state_fips
ON CONFLICT (geography_id) DO UPDATE SET
  geography_type = EXCLUDED.geography_type,
  state_fips = EXCLUDED.state_fips,
  updated_at = NOW();

-- ============================================================================
-- SECTION 3: Insert Metros (CBSAs)
-- ============================================================================

-- Get the primary state for each metro (most counties)
WITH metro_primary_state AS (
  SELECT
    cbsa_code,
    state_fips,
    COUNT(*) as county_count,
    ROW_NUMBER() OVER (PARTITION BY cbsa_code ORDER BY COUNT(*) DESC) as rn
  FROM geography_crosswalk
  WHERE cbsa_code IS NOT NULL AND cbsa_code != ''
    AND state_fips IS NOT NULL
  GROUP BY cbsa_code, state_fips
)
INSERT INTO geography_inheritance (
  geography_id,
  geography_type,
  metro_cbsa,
  state_fips,
  parent_state_fips
)
SELECT DISTINCT ON (gc.cbsa_code)
  gc.cbsa_code as geography_id,
  'metro' as geography_type,
  gc.cbsa_code as metro_cbsa,
  mps.state_fips,
  mps.state_fips as parent_state_fips
FROM geography_crosswalk gc
JOIN metro_primary_state mps ON mps.cbsa_code = gc.cbsa_code AND mps.rn = 1
WHERE gc.cbsa_code IS NOT NULL AND gc.cbsa_code != ''
ORDER BY gc.cbsa_code
ON CONFLICT (geography_id) DO UPDATE SET
  geography_type = EXCLUDED.geography_type,
  metro_cbsa = EXCLUDED.metro_cbsa,
  state_fips = EXCLUDED.state_fips,
  parent_state_fips = EXCLUDED.parent_state_fips,
  updated_at = NOW();

-- ============================================================================
-- SECTION 4: Insert Counties
-- ============================================================================

INSERT INTO geography_inheritance (
  geography_id,
  geography_type,
  county_fips,
  metro_cbsa,
  state_fips,
  parent_metro_cbsa,
  parent_state_fips
)
SELECT DISTINCT ON (county_fips)
  county_fips as geography_id,
  'county' as geography_type,
  county_fips,
  NULLIF(cbsa_code, '') as metro_cbsa,
  state_fips,
  NULLIF(cbsa_code, '') as parent_metro_cbsa,  -- County inherits from Metro if exists
  state_fips as parent_state_fips
FROM geography_crosswalk
WHERE county_fips IS NOT NULL AND county_fips != ''
ORDER BY county_fips
ON CONFLICT (geography_id) DO UPDATE SET
  geography_type = EXCLUDED.geography_type,
  county_fips = EXCLUDED.county_fips,
  metro_cbsa = EXCLUDED.metro_cbsa,
  state_fips = EXCLUDED.state_fips,
  parent_metro_cbsa = EXCLUDED.parent_metro_cbsa,
  parent_state_fips = EXCLUDED.parent_state_fips,
  updated_at = NOW();

-- ============================================================================
-- SECTION 5: Insert ZIP Codes
-- ============================================================================

INSERT INTO geography_inheritance (
  geography_id,
  geography_type,
  zip_code,
  county_fips,
  metro_cbsa,
  state_fips,
  parent_county_fips,
  parent_metro_cbsa,
  parent_state_fips
)
SELECT DISTINCT ON (zip_code)
  zip_code as geography_id,
  'zip' as geography_type,
  zip_code,
  county_fips,
  NULLIF(cbsa_code, '') as metro_cbsa,
  state_fips,
  county_fips as parent_county_fips,
  NULLIF(cbsa_code, '') as parent_metro_cbsa,
  state_fips as parent_state_fips
FROM geography_crosswalk
WHERE zip_code IS NOT NULL AND zip_code != ''
ORDER BY zip_code
ON CONFLICT (geography_id) DO UPDATE SET
  geography_type = EXCLUDED.geography_type,
  zip_code = EXCLUDED.zip_code,
  county_fips = EXCLUDED.county_fips,
  metro_cbsa = EXCLUDED.metro_cbsa,
  state_fips = EXCLUDED.state_fips,
  parent_county_fips = EXCLUDED.parent_county_fips,
  parent_metro_cbsa = EXCLUDED.parent_metro_cbsa,
  parent_state_fips = EXCLUDED.parent_state_fips,
  updated_at = NOW();

COMMIT;

-- ============================================================================
-- Verification Query
-- ============================================================================

SELECT
  geography_type,
  COUNT(*) as count,
  COUNT(parent_county_fips) as has_parent_county,
  COUNT(parent_metro_cbsa) as has_parent_metro,
  COUNT(parent_state_fips) as has_parent_state
FROM geography_inheritance
GROUP BY geography_type
ORDER BY
  CASE geography_type
    WHEN 'national' THEN 1
    WHEN 'state' THEN 2
    WHEN 'metro' THEN 3
    WHEN 'county' THEN 4
    WHEN 'zip' THEN 5
    WHEN 'city' THEN 6
    ELSE 7
  END;
