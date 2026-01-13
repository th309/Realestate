-- Migration 034: Create Zillow City Table and Clean ZIP Table
-- Separates city data from metro table and ensures clean ZIP table

BEGIN;

-- ============================================================================
-- 1. CREATE ZILLOW CITY TABLE
-- ============================================================================

-- Drop if exists (for clean re-run)
DROP TABLE IF EXISTS zillow_city CASCADE;

-- Create zillow_city table (same schema as metro)
CREATE TABLE zillow_city (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id INTEGER NOT NULL,
  region_name TEXT NOT NULL,
  state_code TEXT,
  metro_region_id INTEGER,  -- Link to parent metro
  period_date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  value NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_id, period_date, metric_name)
);

-- Create indexes for zillow_city
CREATE INDEX idx_zillow_city_region ON zillow_city(region_id);
CREATE INDEX idx_zillow_city_date ON zillow_city(period_date);
CREATE INDEX idx_zillow_city_metric ON zillow_city(metric_name);
CREATE INDEX idx_zillow_city_state ON zillow_city(state_code);
CREATE INDEX idx_zillow_city_metro ON zillow_city(metro_region_id);
CREATE INDEX idx_zillow_city_region_metric ON zillow_city(region_id, metric_name);

-- ============================================================================
-- 2. CLEAN ZILLOW ZIP TABLE
-- ============================================================================

-- Truncate zillow_zip for clean ingest
TRUNCATE TABLE zillow_zip;

-- ============================================================================
-- 3. ADD UPDATE TRIGGER FOR ZILLOW_CITY
-- ============================================================================

DROP TRIGGER IF EXISTS update_zillow_city_updated_at ON zillow_city;
CREATE TRIGGER update_zillow_city_updated_at
    BEFORE UPDATE ON zillow_city
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. ENABLE RLS AND ADD POLICY FOR ZILLOW_CITY
-- ============================================================================

ALTER TABLE zillow_city ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read zillow_city" ON zillow_city FOR SELECT USING (true);

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to service role and authenticated users
GRANT SELECT ON zillow_city TO authenticated;
GRANT SELECT ON zillow_city TO anon;
GRANT ALL ON zillow_city TO service_role;

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 034 completed: Created zillow_city table and truncated zillow_zip';
END $$;
