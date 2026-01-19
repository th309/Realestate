-- Create HUD Fair Market Rent table for county-level rent data
-- HUD FMR provides 100% county coverage (unlike ZORI which is limited to major metros)
-- Used as secondary rent source after ZORI, before Census ACS

CREATE TABLE IF NOT EXISTS hud_fmr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  fips_code VARCHAR(5) NOT NULL,
  county_name VARCHAR(100),
  state_fips VARCHAR(2),
  state_name VARCHAR(50),
  metro_code VARCHAR(10),  -- CBSA code if in metro area
  metro_name VARCHAR(200),
  -- Fair Market Rents by bedroom count
  fmr_0br INTEGER,  -- Efficiency/Studio
  fmr_1br INTEGER,  -- 1-Bedroom
  fmr_2br INTEGER,  -- 2-Bedroom (most commonly used for calculations)
  fmr_3br INTEGER,  -- 3-Bedroom
  fmr_4br INTEGER,  -- 4-Bedroom
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, fips_code)
);

-- Indexes for common query patterns
CREATE INDEX idx_hud_fmr_fips ON hud_fmr(fips_code);
CREATE INDEX idx_hud_fmr_year ON hud_fmr(year DESC);
CREATE INDEX idx_hud_fmr_year_fips ON hud_fmr(year, fips_code);
CREATE INDEX idx_hud_fmr_state ON hud_fmr(state_fips);

-- Grant permissions for service role
GRANT ALL ON hud_fmr TO service_role;
GRANT SELECT ON hud_fmr TO anon;
GRANT SELECT ON hud_fmr TO authenticated;

COMMENT ON TABLE hud_fmr IS 'HUD Fair Market Rents by county and bedroom count. FMR is 40th percentile rent used for housing voucher programs.';
COMMENT ON COLUMN hud_fmr.fmr_2br IS 'Most commonly used FMR for rental calculations and cap rate estimates';
