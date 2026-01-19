-- Migration 048: Create census_* and economic_* tables for demographic and economic data
-- Data sources:
--   Census: ACS 5-Year Estimates, County Business Patterns (CBP)
--   Economic: FRED/BLS unemployment, BEA GDP, BEA Regional Price Parities

BEGIN;

-- ============================================================================
-- SECTION 1: CENSUS TABLES (Demographics, Housing, Employment)
-- ============================================================================

-- 1.1 Census National
DROP TABLE IF EXISTS census_national CASCADE;

CREATE TABLE census_national (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,

    -- Demographics
    total_population BIGINT,
    population_yoy DECIMAL,
    median_age DECIMAL,

    -- Economics
    median_household_income INTEGER,
    income_yoy DECIMAL,
    per_capita_income INTEGER,

    -- Housing
    total_housing_units INTEGER,
    owner_occupied_units INTEGER,
    renter_occupied_units INTEGER,
    homeownership_rate DECIMAL,
    median_home_value INTEGER,
    median_gross_rent INTEGER,
    rent_as_pct_of_income DECIMAL,

    -- Employment (from CBP)
    total_employment BIGINT,
    total_establishments INTEGER,
    annual_payroll BIGINT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT census_national_unique UNIQUE (year)
);

CREATE INDEX idx_census_national_year ON census_national(year DESC);

-- 1.2 Census State
DROP TABLE IF EXISTS census_state CASCADE;

CREATE TABLE census_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    state_fips VARCHAR(2) NOT NULL,
    state_name VARCHAR(100),
    state_abbrev VARCHAR(2),

    -- Demographics
    total_population INTEGER,
    population_yoy DECIMAL,
    median_age DECIMAL,

    -- Economics
    median_household_income INTEGER,
    income_yoy DECIMAL,
    per_capita_income INTEGER,

    -- Housing
    total_housing_units INTEGER,
    owner_occupied_units INTEGER,
    renter_occupied_units INTEGER,
    homeownership_rate DECIMAL,
    median_home_value INTEGER,
    median_gross_rent INTEGER,
    rent_as_pct_of_income DECIMAL,

    -- Employment (from CBP)
    total_employment INTEGER,
    total_establishments INTEGER,
    annual_payroll BIGINT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT census_state_unique UNIQUE (year, state_fips)
);

CREATE INDEX idx_census_state_year ON census_state(year DESC);
CREATE INDEX idx_census_state_fips ON census_state(state_fips);
CREATE INDEX idx_census_state_year_fips ON census_state(year DESC, state_fips);

-- 1.3 Census Metro
DROP TABLE IF EXISTS census_metro CASCADE;

CREATE TABLE census_metro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    cbsa_code VARCHAR(5) NOT NULL,
    cbsa_title VARCHAR(200),
    state_fips VARCHAR(2),

    -- Demographics
    total_population INTEGER,
    population_yoy DECIMAL,
    median_age DECIMAL,

    -- Economics
    median_household_income INTEGER,
    income_yoy DECIMAL,
    per_capita_income INTEGER,

    -- Housing
    total_housing_units INTEGER,
    owner_occupied_units INTEGER,
    renter_occupied_units INTEGER,
    homeownership_rate DECIMAL,
    median_home_value INTEGER,
    median_gross_rent INTEGER,
    rent_as_pct_of_income DECIMAL,

    -- Employment (from CBP)
    total_employment INTEGER,
    total_establishments INTEGER,
    annual_payroll BIGINT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT census_metro_unique UNIQUE (year, cbsa_code)
);

CREATE INDEX idx_census_metro_year ON census_metro(year DESC);
CREATE INDEX idx_census_metro_cbsa ON census_metro(cbsa_code);
CREATE INDEX idx_census_metro_year_cbsa ON census_metro(year DESC, cbsa_code);

-- 1.4 Census County
DROP TABLE IF EXISTS census_county CASCADE;

CREATE TABLE census_county (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    fips_code VARCHAR(5) NOT NULL,
    county_name VARCHAR(100),
    state_fips VARCHAR(2),
    state_name VARCHAR(100),

    -- Demographics
    total_population INTEGER,
    population_yoy DECIMAL,
    median_age DECIMAL,

    -- Economics
    median_household_income INTEGER,
    income_yoy DECIMAL,
    per_capita_income INTEGER,

    -- Housing
    total_housing_units INTEGER,
    owner_occupied_units INTEGER,
    renter_occupied_units INTEGER,
    homeownership_rate DECIMAL,
    median_home_value INTEGER,
    median_gross_rent INTEGER,
    rent_as_pct_of_income DECIMAL,

    -- Employment (from CBP)
    total_employment INTEGER,
    total_establishments INTEGER,
    annual_payroll BIGINT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT census_county_unique UNIQUE (year, fips_code)
);

CREATE INDEX idx_census_county_year ON census_county(year DESC);
CREATE INDEX idx_census_county_fips ON census_county(fips_code);
CREATE INDEX idx_census_county_state ON census_county(state_fips);
CREATE INDEX idx_census_county_year_fips ON census_county(year DESC, fips_code);

-- 1.5 Census City (Place)
DROP TABLE IF EXISTS census_city CASCADE;

CREATE TABLE census_city (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    place_fips VARCHAR(7) NOT NULL,  -- State FIPS (2) + Place FIPS (5)
    place_name VARCHAR(200),
    state_fips VARCHAR(2),
    state_name VARCHAR(100),

    -- Demographics
    total_population INTEGER,
    population_yoy DECIMAL,
    median_age DECIMAL,

    -- Economics
    median_household_income INTEGER,
    income_yoy DECIMAL,
    per_capita_income INTEGER,

    -- Housing
    total_housing_units INTEGER,
    owner_occupied_units INTEGER,
    renter_occupied_units INTEGER,
    homeownership_rate DECIMAL,
    median_home_value INTEGER,
    median_gross_rent INTEGER,
    rent_as_pct_of_income DECIMAL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT census_city_unique UNIQUE (year, place_fips)
);

CREATE INDEX idx_census_city_year ON census_city(year DESC);
CREATE INDEX idx_census_city_place ON census_city(place_fips);
CREATE INDEX idx_census_city_state ON census_city(state_fips);
CREATE INDEX idx_census_city_year_place ON census_city(year DESC, place_fips);

-- 1.6 Census ZIP (ZCTA)
DROP TABLE IF EXISTS census_zip CASCADE;

CREATE TABLE census_zip (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    zcta VARCHAR(5) NOT NULL,
    state_fips VARCHAR(2),
    state_name VARCHAR(100),

    -- Demographics
    total_population INTEGER,
    population_yoy DECIMAL,
    median_age DECIMAL,

    -- Economics
    median_household_income INTEGER,
    income_yoy DECIMAL,
    per_capita_income INTEGER,

    -- Housing
    total_housing_units INTEGER,
    owner_occupied_units INTEGER,
    renter_occupied_units INTEGER,
    homeownership_rate DECIMAL,
    median_home_value INTEGER,
    median_gross_rent INTEGER,
    rent_as_pct_of_income DECIMAL,

    -- Employment (from CBP - available at ZIP)
    total_employment INTEGER,
    total_establishments INTEGER,
    annual_payroll BIGINT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT census_zip_unique UNIQUE (year, zcta)
);

CREATE INDEX idx_census_zip_year ON census_zip(year DESC);
CREATE INDEX idx_census_zip_zcta ON census_zip(zcta);
CREATE INDEX idx_census_zip_state ON census_zip(state_fips);
CREATE INDEX idx_census_zip_year_zcta ON census_zip(year DESC, zcta);

-- ============================================================================
-- SECTION 2: ECONOMIC TABLES (Unemployment, GDP, Cost of Living)
-- ============================================================================

-- 2.1 Economic National
DROP TABLE IF EXISTS economic_national CASCADE;

CREATE TABLE economic_national (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,

    -- Unemployment (FRED/BLS - monthly)
    unemployment_rate DECIMAL,
    unemployment_rate_yoy DECIMAL,

    -- Employment (FRED/BLS)
    total_nonfarm_employment BIGINT,
    employment_yoy DECIMAL,

    -- GDP (BEA - annual, NULL for monthly rows)
    gdp_millions DECIMAL,
    real_gdp_millions DECIMAL,
    gdp_yoy DECIMAL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT economic_national_unique UNIQUE (period_date)
);

CREATE INDEX idx_economic_national_date ON economic_national(period_date DESC);

-- 2.2 Economic State
DROP TABLE IF EXISTS economic_state CASCADE;

CREATE TABLE economic_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    state_fips VARCHAR(2) NOT NULL,
    state_name VARCHAR(100),
    state_abbrev VARCHAR(2),

    -- Unemployment (FRED/BLS - monthly)
    unemployment_rate DECIMAL,
    unemployment_rate_yoy DECIMAL,

    -- Employment (FRED/BLS)
    total_nonfarm_employment INTEGER,
    employment_yoy DECIMAL,

    -- GDP (BEA - annual)
    gdp_millions DECIMAL,
    real_gdp_millions DECIMAL,
    gdp_yoy DECIMAL,

    -- Cost of Living (BEA RPP - annual, US=100)
    rpp_all_items DECIMAL,
    rpp_goods DECIMAL,
    rpp_housing DECIMAL,
    rpp_utilities DECIMAL,
    rpp_other_services DECIMAL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT economic_state_unique UNIQUE (period_date, state_fips)
);

CREATE INDEX idx_economic_state_date ON economic_state(period_date DESC);
CREATE INDEX idx_economic_state_fips ON economic_state(state_fips);
CREATE INDEX idx_economic_state_date_fips ON economic_state(period_date DESC, state_fips);

-- 2.3 Economic Metro
DROP TABLE IF EXISTS economic_metro CASCADE;

CREATE TABLE economic_metro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    cbsa_code VARCHAR(5) NOT NULL,
    cbsa_title VARCHAR(200),
    state_fips VARCHAR(2),

    -- Unemployment (FRED/BLS - monthly)
    unemployment_rate DECIMAL,
    unemployment_rate_yoy DECIMAL,

    -- Employment (FRED/BLS)
    total_nonfarm_employment INTEGER,
    employment_yoy DECIMAL,

    -- GDP (BEA - annual)
    gdp_millions DECIMAL,
    real_gdp_millions DECIMAL,
    gdp_yoy DECIMAL,

    -- Cost of Living (BEA RPP - annual, US=100)
    rpp_all_items DECIMAL,
    rpp_goods DECIMAL,
    rpp_housing DECIMAL,
    rpp_utilities DECIMAL,
    rpp_other_services DECIMAL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT economic_metro_unique UNIQUE (period_date, cbsa_code)
);

CREATE INDEX idx_economic_metro_date ON economic_metro(period_date DESC);
CREATE INDEX idx_economic_metro_cbsa ON economic_metro(cbsa_code);
CREATE INDEX idx_economic_metro_date_cbsa ON economic_metro(period_date DESC, cbsa_code);

-- 2.4 Economic County
DROP TABLE IF EXISTS economic_county CASCADE;

CREATE TABLE economic_county (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    fips_code VARCHAR(5) NOT NULL,
    county_name VARCHAR(100),
    state_fips VARCHAR(2),
    state_name VARCHAR(100),

    -- Unemployment (FRED/BLS - monthly)
    unemployment_rate DECIMAL,
    unemployment_rate_yoy DECIMAL,

    -- Employment (FRED/BLS)
    total_nonfarm_employment INTEGER,
    employment_yoy DECIMAL,

    -- GDP (BEA - annual)
    gdp_millions DECIMAL,
    real_gdp_millions DECIMAL,
    gdp_yoy DECIMAL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT economic_county_unique UNIQUE (period_date, fips_code)
);

CREATE INDEX idx_economic_county_date ON economic_county(period_date DESC);
CREATE INDEX idx_economic_county_fips ON economic_county(fips_code);
CREATE INDEX idx_economic_county_state ON economic_county(state_fips);
CREATE INDEX idx_economic_county_date_fips ON economic_county(period_date DESC, fips_code);

-- ============================================================================
-- SECTION 3: ENABLE RLS AND POLICIES
-- ============================================================================

-- Census tables
ALTER TABLE census_national ENABLE ROW LEVEL SECURITY;
ALTER TABLE census_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE census_metro ENABLE ROW LEVEL SECURITY;
ALTER TABLE census_county ENABLE ROW LEVEL SECURITY;
ALTER TABLE census_city ENABLE ROW LEVEL SECURITY;
ALTER TABLE census_zip ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read census_national" ON census_national FOR SELECT USING (true);
CREATE POLICY "Public read census_state" ON census_state FOR SELECT USING (true);
CREATE POLICY "Public read census_metro" ON census_metro FOR SELECT USING (true);
CREATE POLICY "Public read census_county" ON census_county FOR SELECT USING (true);
CREATE POLICY "Public read census_city" ON census_city FOR SELECT USING (true);
CREATE POLICY "Public read census_zip" ON census_zip FOR SELECT USING (true);

-- Economic tables
ALTER TABLE economic_national ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_metro ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_county ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read economic_national" ON economic_national FOR SELECT USING (true);
CREATE POLICY "Public read economic_state" ON economic_state FOR SELECT USING (true);
CREATE POLICY "Public read economic_metro" ON economic_metro FOR SELECT USING (true);
CREATE POLICY "Public read economic_county" ON economic_county FOR SELECT USING (true);

-- ============================================================================
-- SECTION 4: GRANT PERMISSIONS
-- ============================================================================

-- Census tables
GRANT SELECT ON census_national TO authenticated;
GRANT SELECT ON census_national TO anon;
GRANT ALL ON census_national TO service_role;

GRANT SELECT ON census_state TO authenticated;
GRANT SELECT ON census_state TO anon;
GRANT ALL ON census_state TO service_role;

GRANT SELECT ON census_metro TO authenticated;
GRANT SELECT ON census_metro TO anon;
GRANT ALL ON census_metro TO service_role;

GRANT SELECT ON census_county TO authenticated;
GRANT SELECT ON census_county TO anon;
GRANT ALL ON census_county TO service_role;

GRANT SELECT ON census_city TO authenticated;
GRANT SELECT ON census_city TO anon;
GRANT ALL ON census_city TO service_role;

GRANT SELECT ON census_zip TO authenticated;
GRANT SELECT ON census_zip TO anon;
GRANT ALL ON census_zip TO service_role;

-- Economic tables
GRANT SELECT ON economic_national TO authenticated;
GRANT SELECT ON economic_national TO anon;
GRANT ALL ON economic_national TO service_role;

GRANT SELECT ON economic_state TO authenticated;
GRANT SELECT ON economic_state TO anon;
GRANT ALL ON economic_state TO service_role;

GRANT SELECT ON economic_metro TO authenticated;
GRANT SELECT ON economic_metro TO anon;
GRANT ALL ON economic_metro TO service_role;

GRANT SELECT ON economic_county TO authenticated;
GRANT SELECT ON economic_county TO anon;
GRANT ALL ON economic_county TO service_role;

-- ============================================================================
-- SECTION 5: ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE census_national IS 'National-level Census demographic, housing, and employment data from ACS 5-Year and County Business Patterns.';
COMMENT ON TABLE census_state IS 'State-level Census demographic, housing, and employment data from ACS 5-Year and County Business Patterns.';
COMMENT ON TABLE census_metro IS 'Metro (CBSA)-level Census demographic, housing, and employment data from ACS 5-Year and County Business Patterns.';
COMMENT ON TABLE census_county IS 'County-level Census demographic, housing, and employment data from ACS 5-Year and County Business Patterns.';
COMMENT ON TABLE census_city IS 'City/Place-level Census demographic and housing data from ACS 5-Year.';
COMMENT ON TABLE census_zip IS 'ZIP (ZCTA)-level Census demographic, housing, and employment data from ACS 5-Year and County Business Patterns.';

COMMENT ON TABLE economic_national IS 'National-level economic indicators: unemployment (FRED/BLS), GDP (BEA).';
COMMENT ON TABLE economic_state IS 'State-level economic indicators: unemployment (FRED/BLS), GDP (BEA), cost of living (BEA RPP).';
COMMENT ON TABLE economic_metro IS 'Metro (CBSA)-level economic indicators: unemployment (FRED/BLS), GDP (BEA), cost of living (BEA RPP).';
COMMENT ON TABLE economic_county IS 'County-level economic indicators: unemployment (FRED/BLS), GDP (BEA).';

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 048 completed: Created 10 census_* and economic_* tables';
END $$;
