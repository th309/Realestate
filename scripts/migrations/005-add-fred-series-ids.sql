-- Migration: Add FRED Series ID Columns to Normalization Tables
-- Purpose: Store FRED series IDs for state, county, and MSA level economic data
-- Date: 2024-12-19
--
-- This migration adds columns to store FRED series IDs for:
-- - Unemployment Rate
-- - Employment Total
-- - Median Household Income
-- - GDP (for states/MSAs)
-- - Housing Permits/Starts (for states/MSAs)
--
-- FRED Series ID Formats:
-- - States: {STATE_ABBREV}{SUFFIX} (e.g., CAUR = California Unemployment Rate)
-- - Counties: Varies, often {STATE_FIPS}{COUNTY_FIPS}{SUFFIX}
-- - MSAs: Uses CBSA codes, format varies by series

-- ============================================================================
-- STEP 1: Add FRED series ID columns to tiger_states
-- ============================================================================

ALTER TABLE tiger_states 
ADD COLUMN IF NOT EXISTS fred_unemployment_rate_series_id VARCHAR(20);

ALTER TABLE tiger_states 
ADD COLUMN IF NOT EXISTS fred_employment_total_series_id VARCHAR(20);

ALTER TABLE tiger_states 
ADD COLUMN IF NOT EXISTS fred_median_household_income_series_id VARCHAR(20);

ALTER TABLE tiger_states 
ADD COLUMN IF NOT EXISTS fred_gdp_series_id VARCHAR(20);

ALTER TABLE tiger_states 
ADD COLUMN IF NOT EXISTS fred_housing_permits_series_id VARCHAR(20);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tiger_states_fred_unemployment 
ON tiger_states(fred_unemployment_rate_series_id) 
WHERE fred_unemployment_rate_series_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tiger_states_fred_employment 
ON tiger_states(fred_employment_total_series_id) 
WHERE fred_employment_total_series_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Add FRED series ID columns to tiger_counties
-- ============================================================================

ALTER TABLE tiger_counties 
ADD COLUMN IF NOT EXISTS fred_unemployment_rate_series_id VARCHAR(20);

ALTER TABLE tiger_counties 
ADD COLUMN IF NOT EXISTS fred_employment_total_series_id VARCHAR(20);

ALTER TABLE tiger_counties 
ADD COLUMN IF NOT EXISTS fred_median_household_income_series_id VARCHAR(20);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tiger_counties_fred_unemployment 
ON tiger_counties(fred_unemployment_rate_series_id) 
WHERE fred_unemployment_rate_series_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Add FRED series ID columns to tiger_cbsa
-- ============================================================================

ALTER TABLE tiger_cbsa 
ADD COLUMN IF NOT EXISTS fred_unemployment_rate_series_id VARCHAR(20);

ALTER TABLE tiger_cbsa 
ADD COLUMN IF NOT EXISTS fred_employment_total_series_id VARCHAR(20);

ALTER TABLE tiger_cbsa 
ADD COLUMN IF NOT EXISTS fred_median_household_income_series_id VARCHAR(20);

ALTER TABLE tiger_cbsa 
ADD COLUMN IF NOT EXISTS fred_gdp_series_id VARCHAR(20);

ALTER TABLE tiger_cbsa 
ADD COLUMN IF NOT EXISTS fred_housing_permits_series_id VARCHAR(20);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tiger_cbsa_fred_unemployment 
ON tiger_cbsa(fred_unemployment_rate_series_id) 
WHERE fred_unemployment_rate_series_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Add FRED series ID columns to geographic_units
-- ============================================================================

ALTER TABLE geographic_units 
ADD COLUMN IF NOT EXISTS fred_unemployment_rate_series_id VARCHAR(20);

ALTER TABLE geographic_units 
ADD COLUMN IF NOT EXISTS fred_employment_total_series_id VARCHAR(20);

ALTER TABLE geographic_units 
ADD COLUMN IF NOT EXISTS fred_median_household_income_series_id VARCHAR(20);

ALTER TABLE geographic_units 
ADD COLUMN IF NOT EXISTS fred_gdp_series_id VARCHAR(20);

ALTER TABLE geographic_units 
ADD COLUMN IF NOT EXISTS fred_housing_permits_series_id VARCHAR(20);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_geographic_units_fred_unemployment 
ON geographic_units(fred_unemployment_rate_series_id) 
WHERE fred_unemployment_rate_series_id IS NOT NULL;

-- ============================================================================
-- STEP 5: Populate FRED series IDs for states
-- ============================================================================
-- FRED state series format: {STATE_ABBREV}{SUFFIX}
-- Examples:
-- - Unemployment Rate: {STATE}UR (e.g., CAUR, NYUR)
-- - Employment: {STATE}PAYEMS (e.g., CAPAYEMS, NYPAYEMS) - Note: May not exist for all states
-- - Income: Various formats, may need manual lookup

UPDATE tiger_states
SET fred_unemployment_rate_series_id = state_abbreviation || 'UR'
WHERE state_abbreviation IS NOT NULL
AND fred_unemployment_rate_series_id IS NULL;

-- Note: Employment and Income series IDs vary by state and may need manual verification
-- For now, we'll leave them NULL and they can be populated manually or via API lookup

-- ============================================================================
-- STEP 6: Sync FRED series IDs to geographic_units for states
-- ============================================================================

UPDATE geographic_units gu
SET 
  fred_unemployment_rate_series_id = ts.fred_unemployment_rate_series_id,
  fred_employment_total_series_id = ts.fred_employment_total_series_id,
  fred_median_household_income_series_id = ts.fred_median_household_income_series_id,
  fred_gdp_series_id = ts.fred_gdp_series_id,
  fred_housing_permits_series_id = ts.fred_housing_permits_series_id
FROM tiger_states ts
WHERE gu.geoid = ts.geoid
AND gu.level = 'state'
AND ts.fred_unemployment_rate_series_id IS NOT NULL;

-- ============================================================================
-- VERIFICATION QUERIES (for manual checking after migration)
-- ============================================================================
-- 
-- Check how many states have FRED series IDs populated:
-- SELECT COUNT(*) as states_with_unemployment_id
-- FROM tiger_states
-- WHERE fred_unemployment_rate_series_id IS NOT NULL;
--
-- View sample state FRED series IDs:
-- SELECT geoid, name, state_abbreviation, fred_unemployment_rate_series_id
-- FROM tiger_states
-- WHERE fred_unemployment_rate_series_id IS NOT NULL
-- LIMIT 10;
--
-- Check geographic_units sync:
-- SELECT level, COUNT(*) as total, 
--        COUNT(fred_unemployment_rate_series_id) as with_unemployment_id
-- FROM geographic_units
-- WHERE level = 'state'
-- GROUP BY level;
-- ============================================================================

