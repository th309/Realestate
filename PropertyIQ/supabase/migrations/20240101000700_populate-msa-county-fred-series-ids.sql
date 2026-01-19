-- Migration: Populate MSA and County FRED Series IDs
-- Purpose: Populate FRED series IDs for MSA and County levels
-- Date: 2024-12-19
--
-- Note: This migration provides a framework for populating MSA and County FRED series IDs.
-- Due to the complexity and variability of FRED series ID patterns for these geographies,
-- this migration includes:
-- 1. Common pattern attempts (may not work for all)
-- 2. Placeholder structure for manual population
-- 3. Comments documenting known patterns
--
-- FRED Series ID Patterns (documented from research):
-- 
-- MSA Level:
-- - Unemployment: Often uses abbreviated MSA name + "UR" (e.g., LOSA106UR for Los Angeles)
-- - Employment: Often uses abbreviated MSA name + "NA" or SMS/SMU codes
-- - Income/GDP: Varies significantly, may require lookup
-- - Housing Permits: Often uses abbreviated MSA name + "BPPRIVSA"
--
-- County Level:
-- - Unemployment: Often uses {STATE}{COUNTY_ABBREV}URN (e.g., ILCOOK1URN for Cook County, IL)
-- - Employment: Often uses LAUCN{FIPS} format or {STATE}{COUNTY_ABBREV}NA
-- - Income: Often uses MEHOINUS{FIPS} format
--
-- IMPORTANT: Many MSA and County series IDs do not follow consistent patterns.
-- Use the discover-msa-county-fred-ids.ts script to find series IDs via FRED API search.

-- ============================================================================
-- STEP 1: Attempt Common MSA Patterns (Limited Success Expected)
-- ============================================================================
-- Note: These patterns are based on limited examples and may not work for all MSAs.
-- Manual lookup or API discovery is recommended.

-- MSA Unemployment Rate - Pattern: {MSA_CODE}UR (works for some, not all)
-- Example: LOSA106UR for Los Angeles (CBSA 31080)
-- This is a placeholder - actual implementation requires lookup table or API discovery

-- MSA Employment - Pattern varies significantly
-- This is a placeholder - actual implementation requires lookup table or API discovery

-- ============================================================================
-- STEP 2: Attempt Common County Patterns (Limited Success Expected)
-- ============================================================================
-- Note: County patterns are even less consistent than MSA patterns.
-- Manual lookup or API discovery is strongly recommended.

-- County Unemployment Rate - Pattern: {STATE}{COUNTY_ABBREV}URN
-- Example: ILCOOK1URN for Cook County, IL (FIPS 17031)
-- This requires county name abbreviation mapping which is not available

-- County Employment - Pattern: LAUCN{FIPS}0000000005 or similar
-- Example: LAUCN170310000000005 for Cook County, IL
-- This is a placeholder - actual implementation requires lookup

-- ============================================================================
-- STEP 3: Create Helper Function for Manual Population
-- ============================================================================
-- This function can be used to manually update FRED series IDs after discovery

CREATE OR REPLACE FUNCTION update_fred_series_id(
  p_geoid TEXT,
  p_level TEXT, -- 'cbsa' or 'county'
  p_field TEXT, -- 'unemployment_rate', 'employment_total', etc.
  p_series_id TEXT
) RETURNS VOID AS $$
BEGIN
  IF p_level = 'cbsa' THEN
    CASE p_field
      WHEN 'unemployment_rate' THEN
        UPDATE tiger_cbsa SET fred_unemployment_rate_series_id = p_series_id WHERE geoid = p_geoid;
      WHEN 'employment_total' THEN
        UPDATE tiger_cbsa SET fred_employment_total_series_id = p_series_id WHERE geoid = p_geoid;
      WHEN 'median_household_income' THEN
        UPDATE tiger_cbsa SET fred_median_household_income_series_id = p_series_id WHERE geoid = p_geoid;
      WHEN 'gdp' THEN
        UPDATE tiger_cbsa SET fred_gdp_series_id = p_series_id WHERE geoid = p_geoid;
      WHEN 'housing_permits' THEN
        UPDATE tiger_cbsa SET fred_housing_permits_series_id = p_series_id WHERE geoid = p_geoid;
    END CASE;
  ELSIF p_level = 'county' THEN
    CASE p_field
      WHEN 'unemployment_rate' THEN
        UPDATE tiger_counties SET fred_unemployment_rate_series_id = p_series_id WHERE geoid = p_geoid;
      WHEN 'employment_total' THEN
        UPDATE tiger_counties SET fred_employment_total_series_id = p_series_id WHERE geoid = p_geoid;
      WHEN 'median_household_income' THEN
        UPDATE tiger_counties SET fred_median_household_income_series_id = p_series_id WHERE geoid = p_geoid;
    END CASE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Sync to geographic_units (when series IDs are populated)
-- ============================================================================

-- This will be run after series IDs are populated
-- UPDATE geographic_units gu
-- SET 
--   fred_unemployment_rate_series_id = COALESCE(
--     (SELECT fred_unemployment_rate_series_id FROM tiger_cbsa WHERE geoid = gu.geoid AND gu.level = 'cbsa'),
--     (SELECT fred_unemployment_rate_series_id FROM tiger_counties WHERE geoid = gu.geoid AND gu.level = 'county')
--   )
-- WHERE gu.level IN ('cbsa', 'county');

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================
--
-- Manual update for MSA:
-- SELECT update_fred_series_id('31080', 'cbsa', 'unemployment_rate', 'LOSA106UR');
--
-- Manual update for County:
-- SELECT update_fred_series_id('17031', 'county', 'unemployment_rate', 'ILCOOK1URN');
--
-- Bulk update from CSV (after discovery):
-- COPY temp_fred_series_ids(geoid, level, field, series_id) FROM '/path/to/discovery-results.csv' CSV HEADER;
-- Then use update_fred_series_id() function for each row
-- ============================================================================

