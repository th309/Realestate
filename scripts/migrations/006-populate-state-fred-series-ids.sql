-- Migration: Populate State-Level FRED Series IDs
-- Purpose: Auto-populate FRED series IDs for states using known patterns
-- Date: 2024-12-19
--
-- This script populates FRED series IDs for:
-- - Employment Total (PAYEMS)
-- - Median Household Income (MEHOIN)
-- - GDP (NGMP)
-- - Housing Permits (PERMIT)
--
-- Note: These patterns are based on FRED documentation but should be verified
-- using the verify-fred-series-ids.ts script before production use.

-- ============================================================================
-- STEP 1: Populate Employment Total Series IDs
-- ============================================================================
-- Pattern: {STATE_ABBREV}PAYEMS
-- Example: CAPAYEMS = California Total Nonfarm Payrolls

UPDATE tiger_states
SET fred_employment_total_series_id = state_abbreviation || 'PAYEMS'
WHERE state_abbreviation IS NOT NULL
AND fred_employment_total_series_id IS NULL;

-- ============================================================================
-- STEP 2: Populate Median Household Income Series IDs
-- ============================================================================
-- Pattern: MEHOINUS{STATE_FIPS}A646N
-- Example: MEHOINUS06A646N = California Median Household Income (FIPS 06)
-- Note: FIPS codes need to be zero-padded to 2 digits

UPDATE tiger_states
SET fred_median_household_income_series_id = 'MEHOINUS' || LPAD(geoid, 2, '0') || 'A646N'
WHERE geoid IS NOT NULL
AND fred_median_household_income_series_id IS NULL;

-- ============================================================================
-- STEP 3: Populate GDP Series IDs
-- ============================================================================
-- Pattern: NGMP{STATE_FIPS}000ALL
-- Example: NGMP06000ALL = California GDP
-- Note: FIPS codes need to be zero-padded to 2 digits, then add '000ALL'

UPDATE tiger_states
SET fred_gdp_series_id = 'NGMP' || LPAD(geoid, 2, '0') || '000ALL'
WHERE geoid IS NOT NULL
AND fred_gdp_series_id IS NULL;

-- ============================================================================
-- STEP 4: Populate Housing Permits Series IDs
-- ============================================================================
-- Pattern: {STATE_ABBREV}PERMIT
-- Example: CAPERMIT = California Building Permits

UPDATE tiger_states
SET fred_housing_permits_series_id = state_abbreviation || 'PERMIT'
WHERE state_abbreviation IS NOT NULL
AND fred_housing_permits_series_id IS NULL;

-- ============================================================================
-- STEP 5: Sync to geographic_units
-- ============================================================================

UPDATE geographic_units gu
SET 
  fred_employment_total_series_id = ts.fred_employment_total_series_id,
  fred_median_household_income_series_id = ts.fred_median_household_income_series_id,
  fred_gdp_series_id = ts.fred_gdp_series_id,
  fred_housing_permits_series_id = ts.fred_housing_permits_series_id
FROM tiger_states ts
WHERE gu.geoid = ts.geoid
AND gu.level = 'state'
AND (
  ts.fred_employment_total_series_id IS NOT NULL
  OR ts.fred_median_household_income_series_id IS NOT NULL
  OR ts.fred_gdp_series_id IS NOT NULL
  OR ts.fred_housing_permits_series_id IS NOT NULL
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
--
-- Check population status:
-- SELECT 
--   COUNT(*) as total_states,
--   COUNT(fred_unemployment_rate_series_id) as with_unemployment,
--   COUNT(fred_employment_total_series_id) as with_employment,
--   COUNT(fred_median_household_income_series_id) as with_income,
--   COUNT(fred_gdp_series_id) as with_gdp,
--   COUNT(fred_housing_permits_series_id) as with_permits
-- FROM tiger_states;
--
-- View sample populated series IDs:
-- SELECT geoid, name, state_abbreviation,
--        fred_unemployment_rate_series_id,
--        fred_employment_total_series_id,
--        fred_median_household_income_series_id,
--        fred_gdp_series_id,
--        fred_housing_permits_series_id
-- FROM tiger_states
-- WHERE state_abbreviation IN ('CA', 'NY', 'TX', 'FL', 'IL')
-- ORDER BY name;
-- ============================================================================

