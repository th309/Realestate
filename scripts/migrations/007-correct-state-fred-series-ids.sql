-- Migration: Correct State-Level FRED Series IDs
-- Purpose: Update FRED series IDs with correct patterns based on FRED API verification
-- Date: 2024-12-19
--
-- Corrected Patterns:
-- - Employment Total: {STATE_ABBREV}NA (e.g., CANA, NYNA, TXNA)
-- - Median Household Income: MEHOINUS{STATE_ABBREV}A646N (e.g., MEHOINUSCAA646N)
-- - GDP: {STATE_ABBREV}RGSP (e.g., CARGSP) - Real Gross Domestic Product
-- - Housing Permits: {STATE_ABBREV}BPPRIVSA (e.g., CABPPRIVSA) - Seasonally Adjusted

-- ============================================================================
-- STEP 1: Correct Employment Total Series IDs
-- ============================================================================
-- Pattern: {STATE_ABBREV}NA
-- Example: CANA = California All Employees: Total Nonfarm

UPDATE tiger_states
SET fred_employment_total_series_id = state_abbreviation || 'NA'
WHERE state_abbreviation IS NOT NULL;

-- ============================================================================
-- STEP 2: Correct Median Household Income Series IDs
-- ============================================================================
-- Pattern: MEHOINUS{STATE_ABBREV}A646N
-- Example: MEHOINUSCAA646N = California Median Household Income

UPDATE tiger_states
SET fred_median_household_income_series_id = 'MEHOINUS' || state_abbreviation || 'A646N'
WHERE state_abbreviation IS NOT NULL;

-- ============================================================================
-- STEP 3: Correct GDP Series IDs
-- ============================================================================
-- Pattern: {STATE_ABBREV}RGSP
-- Example: CARGSP = California Real Gross Domestic Product

UPDATE tiger_states
SET fred_gdp_series_id = state_abbreviation || 'RGSP'
WHERE state_abbreviation IS NOT NULL;

-- ============================================================================
-- STEP 4: Correct Housing Permits Series IDs
-- ============================================================================
-- Pattern: {STATE_ABBREV}BPPRIVSA
-- Example: CABPPRIVSA = California New Private Housing Units Authorized by Building Permits (SA)

UPDATE tiger_states
SET fred_housing_permits_series_id = state_abbreviation || 'BPPRIVSA'
WHERE state_abbreviation IS NOT NULL;

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
AND gu.level = 'state';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
--
-- View sample corrected series IDs:
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

