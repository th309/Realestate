-- Migration 035: Create Zillow Metro Crosswalk Table
-- Maps Zillow RegionIDs to Census CBSA codes for metro areas

BEGIN;

-- ============================================================================
-- 1. CREATE ZILLOW METRO CROSSWALK TABLE
-- ============================================================================

-- Drop if exists (for clean re-run)
DROP TABLE IF EXISTS zillow_metro_crosswalk CASCADE;

-- Create crosswalk table
CREATE TABLE zillow_metro_crosswalk (
  zillow_region_id INTEGER PRIMARY KEY,
  zillow_region_name TEXT NOT NULL,
  zillow_state_name TEXT,
  cbsa_code TEXT NOT NULL,
  cbsa_title TEXT,
  cbsa_type TEXT,  -- 'Metropolitan Statistical Area' or 'Micropolitan Statistical Area'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_crosswalk_cbsa ON zillow_metro_crosswalk(cbsa_code);
CREATE INDEX idx_crosswalk_state ON zillow_metro_crosswalk(zillow_state_name);

-- ============================================================================
-- 2. ENABLE RLS AND ADD POLICY
-- ============================================================================

ALTER TABLE zillow_metro_crosswalk ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read zillow_metro_crosswalk" ON zillow_metro_crosswalk FOR SELECT USING (true);

-- ============================================================================
-- 3. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON zillow_metro_crosswalk TO authenticated;
GRANT SELECT ON zillow_metro_crosswalk TO anon;
GRANT ALL ON zillow_metro_crosswalk TO service_role;

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 035 completed: Created zillow_metro_crosswalk table';
END $$;
