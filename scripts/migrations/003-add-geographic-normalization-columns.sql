-- Migration: Add Geographic Normalization Columns
-- Purpose: Add columns to TIGER tables to support CSV import from normalization files
-- Date: 2024-12-19
-- 
-- This migration adds population and metadata columns to:
-- - tiger_states (state_abbreviation, population, name_fragment)
-- - tiger_counties (population, county_name_fragment, pct_of_state_population)
-- - tiger_cbsa (population)
-- - tiger_zcta (population, default_city, default_state, cbsa_code)
--
-- All columns use IF NOT EXISTS to allow safe re-running of the migration

-- ============================================================================
-- STEP 1: ALTER TABLE tiger_states
-- ============================================================================

-- Add state_abbreviation column
ALTER TABLE tiger_states 
ADD COLUMN IF NOT EXISTS state_abbreviation VARCHAR(2);

-- Add population column
ALTER TABLE tiger_states 
ADD COLUMN IF NOT EXISTS population BIGINT;

-- Add name_fragment column (URL-friendly slug)
ALTER TABLE tiger_states 
ADD COLUMN IF NOT EXISTS name_fragment VARCHAR(100);

-- Create index on state_abbreviation
CREATE INDEX IF NOT EXISTS idx_tiger_states_abbreviation 
ON tiger_states(state_abbreviation);

-- Create index on population
CREATE INDEX IF NOT EXISTS idx_tiger_states_population 
ON tiger_states(population);

-- ============================================================================
-- STEP 2: ALTER TABLE tiger_counties
-- ============================================================================

-- Add population column
ALTER TABLE tiger_counties 
ADD COLUMN IF NOT EXISTS population BIGINT;

-- Add county_name_fragment column (URL-friendly slug)
ALTER TABLE tiger_counties 
ADD COLUMN IF NOT EXISTS county_name_fragment VARCHAR(255);

-- Add pct_of_state_population column (percentage as decimal, e.g., 0.1234 for 12.34%)
ALTER TABLE tiger_counties 
ADD COLUMN IF NOT EXISTS pct_of_state_population DECIMAL(10,8);

-- Create index on population
CREATE INDEX IF NOT EXISTS idx_tiger_counties_population 
ON tiger_counties(population);

-- Create composite index on (state_fips, population) for state-level queries
CREATE INDEX IF NOT EXISTS idx_tiger_counties_state_pop 
ON tiger_counties(state_fips, population);

-- ============================================================================
-- STEP 3: ALTER TABLE tiger_cbsa
-- ============================================================================

-- Add population column
ALTER TABLE tiger_cbsa 
ADD COLUMN IF NOT EXISTS population BIGINT;

-- Create index on population
CREATE INDEX IF NOT EXISTS idx_tiger_cbsa_population 
ON tiger_cbsa(population);

-- ============================================================================
-- STEP 4: ALTER TABLE tiger_zcta
-- ============================================================================

-- Add population column
ALTER TABLE tiger_zcta 
ADD COLUMN IF NOT EXISTS population BIGINT;

-- Add default_city column (USPS default city for ZIP)
ALTER TABLE tiger_zcta 
ADD COLUMN IF NOT EXISTS default_city VARCHAR(255);

-- Add default_state column (USPS default state abbreviation for ZIP)
ALTER TABLE tiger_zcta 
ADD COLUMN IF NOT EXISTS default_state VARCHAR(2);

-- Add cbsa_code column (primary CBSA code for ZIP)
ALTER TABLE tiger_zcta 
ADD COLUMN IF NOT EXISTS cbsa_code VARCHAR(5);

-- Create index on population
CREATE INDEX IF NOT EXISTS idx_tiger_zcta_population 
ON tiger_zcta(population);

-- Create index on cbsa_code for CBSA lookups
CREATE INDEX IF NOT EXISTS idx_tiger_zcta_cbsa_code 
ON tiger_zcta(cbsa_code);

-- Create index on default_state for state-level queries
CREATE INDEX IF NOT EXISTS idx_tiger_zcta_default_state 
ON tiger_zcta(default_state);

-- ============================================================================
-- VERIFICATION QUERIES (for manual checking after migration)
-- ============================================================================
-- 
-- Verify columns were added:
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'tiger_states' AND column_name IN ('state_abbreviation', 'population', 'name_fragment');
--
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'tiger_counties' AND column_name IN ('population', 'county_name_fragment', 'pct_of_state_population');
--
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'tiger_cbsa' AND column_name = 'population';
--
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'tiger_zcta' AND column_name IN ('population', 'default_city', 'default_state', 'cbsa_code');
--
-- Verify indexes were created:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('tiger_states', 'tiger_counties', 'tiger_cbsa', 'tiger_zcta')
-- AND indexname LIKE 'idx_tiger_%';
-- ============================================================================

