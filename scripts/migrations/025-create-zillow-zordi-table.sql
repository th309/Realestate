-- Migration: Create Zillow Observed Renter Demand Index (ZORDI) Table
-- Purpose: Store Zillow's renter demand index data
-- Date: 2026-01-10
--
-- ZORDI (Zillow Observed Renter Demand Index) measures the relative demand
-- for rentals in a given area. Higher values indicate stronger renter demand.
-- This is DIFFERENT from ZORI (Rent Index) which measures actual rent prices.
--
-- Available geographies: Metro, Zip
-- Available property types: All Homes, Single Family, Multifamily

-- ============================================================================
-- 1. Zillow Observed Renter Demand Index (ZORDI) Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_zordi (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(20, 4) NOT NULL,       -- Index value (not a dollar amount)
    property_type VARCHAR(50),            -- 'All Homes Plus Multifamily', 'SFR', 'Multifamily'
    geography VARCHAR(50),                -- 'Metro', 'Zip'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_zillow_zordi_region_date
    ON zillow_zordi(region_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_zillow_zordi_geography_date
    ON zillow_zordi(geography, date DESC);

CREATE INDEX IF NOT EXISTS idx_zillow_zordi_date
    ON zillow_zordi(date DESC);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_zordi_unique
    ON zillow_zordi(region_id, date, property_type, geography);

-- ============================================================================
-- 2. Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE zillow_zordi TO service_role;
GRANT SELECT ON TABLE zillow_zordi TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE zillow_zordi_id_seq TO service_role;

-- Disable RLS for simpler access
ALTER TABLE zillow_zordi DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Add updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_zillow_zordi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_zillow_zordi_updated_at ON zillow_zordi;
CREATE TRIGGER trigger_zillow_zordi_updated_at
    BEFORE UPDATE ON zillow_zordi
    FOR EACH ROW
    EXECUTE FUNCTION update_zillow_zordi_updated_at();

-- ============================================================================
-- 4. Comments
-- ============================================================================
COMMENT ON TABLE zillow_zordi IS 'Zillow Observed Renter Demand Index (ZORDI) - measures relative renter demand in an area';
COMMENT ON COLUMN zillow_zordi.value IS 'Index value representing relative renter demand (higher = more demand)';
COMMENT ON COLUMN zillow_zordi.property_type IS 'Property type: All Homes Plus Multifamily, SFR, or Multifamily';
