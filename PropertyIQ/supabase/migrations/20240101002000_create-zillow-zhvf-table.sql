-- Migration: Create Zillow Home Value Forecast (ZHVF) Table
-- Purpose: Store Zillow's home value forecast data for metros and ZIP codes
-- Date: 2026-01-10
--
-- ZHVF provides month-ahead, quarter-ahead, and year-ahead forecasts
-- of the Zillow Home Value Index (ZHVI).

-- ============================================================================
-- 1. Zillow Home Value Forecast (ZHVF) Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_zhvf (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,                    -- Forecast base date
    forecast_1m DECIMAL(10, 4),            -- 1-month forecast (% change)
    forecast_3m DECIMAL(10, 4),            -- 3-month (quarter) forecast (% change)
    forecast_12m DECIMAL(10, 4),           -- 12-month (year) forecast (% change)
    geography VARCHAR(50) NOT NULL,        -- 'Metro', 'Zip', 'State', 'US'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_zillow_zhvf_region_date
    ON zillow_zhvf(region_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_zillow_zhvf_geography_date
    ON zillow_zhvf(geography, date DESC);

CREATE INDEX IF NOT EXISTS idx_zillow_zhvf_date
    ON zillow_zhvf(date DESC);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_zhvf_unique
    ON zillow_zhvf(region_id, date, geography);

-- ============================================================================
-- 2. Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE zillow_zhvf TO service_role;
GRANT SELECT ON TABLE zillow_zhvf TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE zillow_zhvf_id_seq TO service_role;

-- Disable RLS for simpler access
ALTER TABLE zillow_zhvf DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Add updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_zillow_zhvf_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_zillow_zhvf_updated_at ON zillow_zhvf;
CREATE TRIGGER trigger_zillow_zhvf_updated_at
    BEFORE UPDATE ON zillow_zhvf
    FOR EACH ROW
    EXECUTE FUNCTION update_zillow_zhvf_updated_at();

-- ============================================================================
-- 4. Comments
-- ============================================================================
COMMENT ON TABLE zillow_zhvf IS 'Zillow Home Value Forecast (ZHVF) - forecasted home value changes';
COMMENT ON COLUMN zillow_zhvf.forecast_1m IS '1-month ahead forecast as percentage change';
COMMENT ON COLUMN zillow_zhvf.forecast_3m IS '3-month ahead (quarterly) forecast as percentage change';
COMMENT ON COLUMN zillow_zhvf.forecast_12m IS '12-month ahead (yearly) forecast as percentage change';
