-- Migration 053: Create Redfin Rental tables for rental market data
-- Data sourced from Redfin Tableau dashboard (https://www.redfin.com/news/data-center/rental-market-data/)
-- Follows the source_geography naming pattern (e.g., redfin_national, redfin_metro)

BEGIN;

-- ============================================================================
-- 1. CREATE REDFIN RENTAL NATIONAL TABLE
-- ============================================================================

DROP TABLE IF EXISTS redfin_rental_national CASCADE;

CREATE TABLE redfin_rental_national (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    
    -- Rental metrics
    median_asking_rent DECIMAL,
    median_asking_rent_yoy DECIMAL,
    median_asking_rent_psf DECIMAL,
    median_asking_rent_psf_yoy DECIMAL,
    
    -- Bedroom mix (share percentages)
    bedroom_0_1_share DECIMAL,
    bedroom_2_share DECIMAL,
    bedroom_3_plus_share DECIMAL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT redfin_rental_national_unique UNIQUE (period_date)
);

CREATE INDEX idx_redfin_rental_national_date ON redfin_rental_national(period_date DESC);

-- ============================================================================
-- 2. CREATE REDFIN RENTAL STATE TABLE
-- ============================================================================

DROP TABLE IF EXISTS redfin_rental_state CASCADE;

CREATE TABLE redfin_rental_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    state_name VARCHAR(50),
    
    -- Rental metrics
    median_asking_rent DECIMAL,
    median_asking_rent_yoy DECIMAL,
    median_asking_rent_psf DECIMAL,
    median_asking_rent_psf_yoy DECIMAL,
    
    -- Bedroom mix (share percentages)
    bedroom_0_1_share DECIMAL,
    bedroom_2_share DECIMAL,
    bedroom_3_plus_share DECIMAL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT redfin_rental_state_unique UNIQUE (period_date, state_code)
);

CREATE INDEX idx_redfin_rental_state_date ON redfin_rental_state(period_date DESC);
CREATE INDEX idx_redfin_rental_state_code ON redfin_rental_state(state_code);
CREATE INDEX idx_redfin_rental_state_combo ON redfin_rental_state(state_code, period_date DESC);

-- ============================================================================
-- 3. CREATE REDFIN RENTAL METRO TABLE
-- ============================================================================

DROP TABLE IF EXISTS redfin_rental_metro CASCADE;

CREATE TABLE redfin_rental_metro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    cbsa_code VARCHAR(10),
    cbsa_title VARCHAR(200) NOT NULL,
    
    -- Rental metrics
    median_asking_rent DECIMAL,
    median_asking_rent_yoy DECIMAL,
    median_asking_rent_psf DECIMAL,
    median_asking_rent_psf_yoy DECIMAL,
    
    -- Bedroom mix (share percentages)
    bedroom_0_1_share DECIMAL,
    bedroom_2_share DECIMAL,
    bedroom_3_plus_share DECIMAL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT redfin_rental_metro_unique UNIQUE (period_date, cbsa_title)
);

CREATE INDEX idx_redfin_rental_metro_date ON redfin_rental_metro(period_date DESC);
CREATE INDEX idx_redfin_rental_metro_cbsa ON redfin_rental_metro(cbsa_code);
CREATE INDEX idx_redfin_rental_metro_title ON redfin_rental_metro(cbsa_title);
CREATE INDEX idx_redfin_rental_metro_combo ON redfin_rental_metro(cbsa_code, period_date DESC);

-- ============================================================================
-- 4. CREATE REDFIN RENTAL COUNTY TABLE
-- ============================================================================

DROP TABLE IF EXISTS redfin_rental_county CASCADE;

CREATE TABLE redfin_rental_county (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    fips_code VARCHAR(5) NOT NULL,
    county_name VARCHAR(100),
    state_code VARCHAR(2),
    
    -- Rental metrics
    median_asking_rent DECIMAL,
    median_asking_rent_yoy DECIMAL,
    median_asking_rent_psf DECIMAL,
    median_asking_rent_psf_yoy DECIMAL,
    
    -- Bedroom mix (share percentages)
    bedroom_0_1_share DECIMAL,
    bedroom_2_share DECIMAL,
    bedroom_3_plus_share DECIMAL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT redfin_rental_county_unique UNIQUE (period_date, fips_code)
);

CREATE INDEX idx_redfin_rental_county_date ON redfin_rental_county(period_date DESC);
CREATE INDEX idx_redfin_rental_county_fips ON redfin_rental_county(fips_code);
CREATE INDEX idx_redfin_rental_county_state ON redfin_rental_county(state_code);
CREATE INDEX idx_redfin_rental_county_combo ON redfin_rental_county(fips_code, period_date DESC);

-- ============================================================================
-- 5. CREATE REDFIN RENTAL CITY TABLE
-- ============================================================================

DROP TABLE IF EXISTS redfin_rental_city CASCADE;

CREATE TABLE redfin_rental_city (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    city_name VARCHAR(100) NOT NULL,
    state_code VARCHAR(2),
    
    -- Rental metrics
    median_asking_rent DECIMAL,
    median_asking_rent_yoy DECIMAL,
    median_asking_rent_psf DECIMAL,
    median_asking_rent_psf_yoy DECIMAL,
    
    -- Bedroom mix (share percentages)
    bedroom_0_1_share DECIMAL,
    bedroom_2_share DECIMAL,
    bedroom_3_plus_share DECIMAL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT redfin_rental_city_unique UNIQUE (period_date, city_name, state_code)
);

CREATE INDEX idx_redfin_rental_city_date ON redfin_rental_city(period_date DESC);
CREATE INDEX idx_redfin_rental_city_name ON redfin_rental_city(city_name);
CREATE INDEX idx_redfin_rental_city_state ON redfin_rental_city(state_code);
CREATE INDEX idx_redfin_rental_city_combo ON redfin_rental_city(city_name, state_code, period_date DESC);

-- ============================================================================
-- 6. CREATE REDFIN RENTAL ZIP TABLE
-- ============================================================================

DROP TABLE IF EXISTS redfin_rental_zip CASCADE;

CREATE TABLE redfin_rental_zip (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    zip_code VARCHAR(5) NOT NULL,
    state_code VARCHAR(2),
    
    -- Rental metrics
    median_asking_rent DECIMAL,
    median_asking_rent_yoy DECIMAL,
    median_asking_rent_psf DECIMAL,
    median_asking_rent_psf_yoy DECIMAL,
    
    -- Bedroom mix (share percentages)
    bedroom_0_1_share DECIMAL,
    bedroom_2_share DECIMAL,
    bedroom_3_plus_share DECIMAL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT redfin_rental_zip_unique UNIQUE (period_date, zip_code)
);

CREATE INDEX idx_redfin_rental_zip_date ON redfin_rental_zip(period_date DESC);
CREATE INDEX idx_redfin_rental_zip_code ON redfin_rental_zip(zip_code);
CREATE INDEX idx_redfin_rental_zip_state ON redfin_rental_zip(state_code);
CREATE INDEX idx_redfin_rental_zip_combo ON redfin_rental_zip(zip_code, period_date DESC);

-- ============================================================================
-- 7. ENABLE RLS AND ADD POLICIES
-- ============================================================================

ALTER TABLE redfin_rental_national ENABLE ROW LEVEL SECURITY;
ALTER TABLE redfin_rental_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE redfin_rental_metro ENABLE ROW LEVEL SECURITY;
ALTER TABLE redfin_rental_county ENABLE ROW LEVEL SECURITY;
ALTER TABLE redfin_rental_city ENABLE ROW LEVEL SECURITY;
ALTER TABLE redfin_rental_zip ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read redfin_rental_national" ON redfin_rental_national FOR SELECT USING (true);
CREATE POLICY "Public read redfin_rental_state" ON redfin_rental_state FOR SELECT USING (true);
CREATE POLICY "Public read redfin_rental_metro" ON redfin_rental_metro FOR SELECT USING (true);
CREATE POLICY "Public read redfin_rental_county" ON redfin_rental_county FOR SELECT USING (true);
CREATE POLICY "Public read redfin_rental_city" ON redfin_rental_city FOR SELECT USING (true);
CREATE POLICY "Public read redfin_rental_zip" ON redfin_rental_zip FOR SELECT USING (true);

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON redfin_rental_national TO authenticated;
GRANT SELECT ON redfin_rental_national TO anon;
GRANT ALL ON redfin_rental_national TO service_role;

GRANT SELECT ON redfin_rental_state TO authenticated;
GRANT SELECT ON redfin_rental_state TO anon;
GRANT ALL ON redfin_rental_state TO service_role;

GRANT SELECT ON redfin_rental_metro TO authenticated;
GRANT SELECT ON redfin_rental_metro TO anon;
GRANT ALL ON redfin_rental_metro TO service_role;

GRANT SELECT ON redfin_rental_county TO authenticated;
GRANT SELECT ON redfin_rental_county TO anon;
GRANT ALL ON redfin_rental_county TO service_role;

GRANT SELECT ON redfin_rental_city TO authenticated;
GRANT SELECT ON redfin_rental_city TO anon;
GRANT ALL ON redfin_rental_city TO service_role;

GRANT SELECT ON redfin_rental_zip TO authenticated;
GRANT SELECT ON redfin_rental_zip TO anon;
GRANT ALL ON redfin_rental_zip TO service_role;

-- ============================================================================
-- 9. ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE redfin_rental_national IS 'National-level Redfin rental market data (asking rents, bedroom mix). Source: Redfin Tableau Dashboard.';
COMMENT ON TABLE redfin_rental_state IS 'State-level Redfin rental market data (asking rents, bedroom mix). Source: Redfin Tableau Dashboard.';
COMMENT ON TABLE redfin_rental_metro IS 'Metro/CBSA-level Redfin rental market data (asking rents, bedroom mix). Source: Redfin Tableau Dashboard.';
COMMENT ON TABLE redfin_rental_county IS 'County-level Redfin rental market data (asking rents, bedroom mix). Source: Redfin Tableau Dashboard.';
COMMENT ON TABLE redfin_rental_city IS 'City-level Redfin rental market data (asking rents, bedroom mix). Source: Redfin Tableau Dashboard.';
COMMENT ON TABLE redfin_rental_zip IS 'ZIP code-level Redfin rental market data (asking rents, bedroom mix). Source: Redfin Tableau Dashboard.';

COMMIT;

DO $$
BEGIN
    RAISE NOTICE 'Migration 053 completed: Created redfin_rental_* tables (national, state, metro, county, city, zip)';
END $$;
