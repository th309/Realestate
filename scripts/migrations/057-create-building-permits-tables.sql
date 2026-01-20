-- Migration 057: Create building permits tables for Census BPS data
-- Data source: U.S. Census Bureau Building Permits Survey (BPS)
-- URL: https://www2.census.gov/econ/bps/
-- Contains monthly permit data for single-family and multifamily housing

BEGIN;

-- ============================================================================
-- SECTION 1: PERMITS_STATE (State-level building permits)
-- ============================================================================

DROP TABLE IF EXISTS permits_state CASCADE;

CREATE TABLE permits_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,  -- First of month (YYYY-MM-01)
    state_fips VARCHAR(2) NOT NULL,
    state_name VARCHAR(100),

    -- Single-family (1-unit)
    sf_buildings INTEGER,
    sf_units INTEGER,
    sf_value BIGINT,  -- In dollars

    -- Duplex (2-units)
    duplex_buildings INTEGER,
    duplex_units INTEGER,
    duplex_value BIGINT,

    -- Small multifamily (3-4 units)
    small_multi_buildings INTEGER,
    small_multi_units INTEGER,
    small_multi_value BIGINT,

    -- Large multifamily (5+ units)
    large_multi_buildings INTEGER,
    large_multi_units INTEGER,
    large_multi_value BIGINT,

    -- Totals (all unit types combined)
    total_buildings INTEGER,
    total_units INTEGER,
    total_value BIGINT,

    -- Year-over-year growth rates
    sf_units_yoy DECIMAL,
    total_units_yoy DECIMAL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT permits_state_unique UNIQUE (period_date, state_fips)
);

CREATE INDEX idx_permits_state_period ON permits_state(period_date DESC);
CREATE INDEX idx_permits_state_fips ON permits_state(state_fips);
CREATE INDEX idx_permits_state_period_fips ON permits_state(period_date DESC, state_fips);

-- ============================================================================
-- SECTION 2: PERMITS_METRO (Metro/CBSA-level building permits)
-- ============================================================================

DROP TABLE IF EXISTS permits_metro CASCADE;

CREATE TABLE permits_metro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    cbsa_code VARCHAR(5) NOT NULL,
    cbsa_title VARCHAR(200),
    cbsa_type VARCHAR(20),  -- 'Metropolitan' or 'Micropolitan'

    -- Single-family (1-unit)
    sf_buildings INTEGER,
    sf_units INTEGER,
    sf_value BIGINT,

    -- Duplex (2-units)
    duplex_buildings INTEGER,
    duplex_units INTEGER,
    duplex_value BIGINT,

    -- Small multifamily (3-4 units)
    small_multi_buildings INTEGER,
    small_multi_units INTEGER,
    small_multi_value BIGINT,

    -- Large multifamily (5+ units)
    large_multi_buildings INTEGER,
    large_multi_units INTEGER,
    large_multi_value BIGINT,

    -- Totals
    total_buildings INTEGER,
    total_units INTEGER,
    total_value BIGINT,

    -- Year-over-year growth rates
    sf_units_yoy DECIMAL,
    total_units_yoy DECIMAL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT permits_metro_unique UNIQUE (period_date, cbsa_code)
);

CREATE INDEX idx_permits_metro_period ON permits_metro(period_date DESC);
CREATE INDEX idx_permits_metro_cbsa ON permits_metro(cbsa_code);
CREATE INDEX idx_permits_metro_period_cbsa ON permits_metro(period_date DESC, cbsa_code);

-- ============================================================================
-- SECTION 3: PERMITS_COUNTY (County-level building permits)
-- ============================================================================

DROP TABLE IF EXISTS permits_county CASCADE;

CREATE TABLE permits_county (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    fips_code VARCHAR(5) NOT NULL,  -- 5-digit county FIPS (state + county)
    county_name VARCHAR(100),
    state_fips VARCHAR(2),
    region_code VARCHAR(1),
    division_code VARCHAR(1),

    -- Single-family (1-unit)
    sf_buildings INTEGER,
    sf_units INTEGER,
    sf_value BIGINT,

    -- Duplex (2-units)
    duplex_buildings INTEGER,
    duplex_units INTEGER,
    duplex_value BIGINT,

    -- Small multifamily (3-4 units)
    small_multi_buildings INTEGER,
    small_multi_units INTEGER,
    small_multi_value BIGINT,

    -- Large multifamily (5+ units)
    large_multi_buildings INTEGER,
    large_multi_units INTEGER,
    large_multi_value BIGINT,

    -- Totals
    total_buildings INTEGER,
    total_units INTEGER,
    total_value BIGINT,

    -- Year-over-year growth rates
    sf_units_yoy DECIMAL,
    total_units_yoy DECIMAL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT permits_county_unique UNIQUE (period_date, fips_code)
);

CREATE INDEX idx_permits_county_period ON permits_county(period_date DESC);
CREATE INDEX idx_permits_county_fips ON permits_county(fips_code);
CREATE INDEX idx_permits_county_state ON permits_county(state_fips);
CREATE INDEX idx_permits_county_period_fips ON permits_county(period_date DESC, fips_code);

-- ============================================================================
-- SECTION 4: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE permits_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE permits_metro ENABLE ROW LEVEL SECURITY;
ALTER TABLE permits_county ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read permits_state" ON permits_state FOR SELECT USING (true);
CREATE POLICY "Public read permits_metro" ON permits_metro FOR SELECT USING (true);
CREATE POLICY "Public read permits_county" ON permits_county FOR SELECT USING (true);

-- ============================================================================
-- SECTION 5: PERMISSIONS
-- ============================================================================

GRANT SELECT ON permits_state TO authenticated;
GRANT SELECT ON permits_state TO anon;
GRANT ALL ON permits_state TO service_role;

GRANT SELECT ON permits_metro TO authenticated;
GRANT SELECT ON permits_metro TO anon;
GRANT ALL ON permits_metro TO service_role;

GRANT SELECT ON permits_county TO authenticated;
GRANT SELECT ON permits_county TO anon;
GRANT ALL ON permits_county TO service_role;

-- ============================================================================
-- SECTION 6: HELPER FUNCTIONS FOR LATEST DATA
-- ============================================================================

-- Get latest permits data per county (most recent month)
CREATE OR REPLACE FUNCTION get_latest_permits_county(p_metric TEXT)
RETURNS TABLE (
    fips_code VARCHAR(5),
    period_date DATE,
    county_name VARCHAR(100),
    state_fips VARCHAR(2),
    metric_value DECIMAL
)
LANGUAGE SQL
STABLE
AS $$
    SELECT DISTINCT ON (pc.fips_code)
        pc.fips_code,
        pc.period_date,
        pc.county_name,
        pc.state_fips,
        CASE p_metric
            WHEN 'sf_units' THEN pc.sf_units::DECIMAL
            WHEN 'sf_buildings' THEN pc.sf_buildings::DECIMAL
            WHEN 'sf_value' THEN pc.sf_value::DECIMAL
            WHEN 'total_units' THEN pc.total_units::DECIMAL
            WHEN 'total_buildings' THEN pc.total_buildings::DECIMAL
            WHEN 'total_value' THEN pc.total_value::DECIMAL
            WHEN 'large_multi_units' THEN pc.large_multi_units::DECIMAL
            WHEN 'sf_units_yoy' THEN pc.sf_units_yoy
            WHEN 'total_units_yoy' THEN pc.total_units_yoy
            ELSE NULL
        END AS metric_value
    FROM permits_county pc
    WHERE
        CASE p_metric
            WHEN 'sf_units' THEN pc.sf_units IS NOT NULL
            WHEN 'sf_buildings' THEN pc.sf_buildings IS NOT NULL
            WHEN 'sf_value' THEN pc.sf_value IS NOT NULL
            WHEN 'total_units' THEN pc.total_units IS NOT NULL
            WHEN 'total_buildings' THEN pc.total_buildings IS NOT NULL
            WHEN 'total_value' THEN pc.total_value IS NOT NULL
            WHEN 'large_multi_units' THEN pc.large_multi_units IS NOT NULL
            WHEN 'sf_units_yoy' THEN pc.sf_units_yoy IS NOT NULL
            WHEN 'total_units_yoy' THEN pc.total_units_yoy IS NOT NULL
            ELSE FALSE
        END
    ORDER BY pc.fips_code, pc.period_date DESC;
$$;

-- Get latest permits data per metro
CREATE OR REPLACE FUNCTION get_latest_permits_metro(p_metric TEXT)
RETURNS TABLE (
    cbsa_code VARCHAR(5),
    period_date DATE,
    cbsa_title VARCHAR(200),
    metric_value DECIMAL
)
LANGUAGE SQL
STABLE
AS $$
    SELECT DISTINCT ON (pm.cbsa_code)
        pm.cbsa_code,
        pm.period_date,
        pm.cbsa_title,
        CASE p_metric
            WHEN 'sf_units' THEN pm.sf_units::DECIMAL
            WHEN 'sf_buildings' THEN pm.sf_buildings::DECIMAL
            WHEN 'sf_value' THEN pm.sf_value::DECIMAL
            WHEN 'total_units' THEN pm.total_units::DECIMAL
            WHEN 'total_buildings' THEN pm.total_buildings::DECIMAL
            WHEN 'total_value' THEN pm.total_value::DECIMAL
            WHEN 'large_multi_units' THEN pm.large_multi_units::DECIMAL
            WHEN 'sf_units_yoy' THEN pm.sf_units_yoy
            WHEN 'total_units_yoy' THEN pm.total_units_yoy
            ELSE NULL
        END AS metric_value
    FROM permits_metro pm
    WHERE
        CASE p_metric
            WHEN 'sf_units' THEN pm.sf_units IS NOT NULL
            WHEN 'sf_buildings' THEN pm.sf_buildings IS NOT NULL
            WHEN 'sf_value' THEN pm.sf_value IS NOT NULL
            WHEN 'total_units' THEN pm.total_units IS NOT NULL
            WHEN 'total_buildings' THEN pm.total_buildings IS NOT NULL
            WHEN 'total_value' THEN pm.total_value IS NOT NULL
            WHEN 'large_multi_units' THEN pm.large_multi_units IS NOT NULL
            WHEN 'sf_units_yoy' THEN pm.sf_units_yoy IS NOT NULL
            WHEN 'total_units_yoy' THEN pm.total_units_yoy IS NOT NULL
            ELSE FALSE
        END
    ORDER BY pm.cbsa_code, pm.period_date DESC;
$$;

GRANT EXECUTE ON FUNCTION get_latest_permits_county(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_latest_permits_metro(TEXT) TO authenticated, anon, service_role;

-- ============================================================================
-- SECTION 7: TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE permits_state IS 'State-level building permits from Census Bureau BPS. Monthly data for SF/MF housing units.';
COMMENT ON TABLE permits_metro IS 'Metro/CBSA-level building permits from Census Bureau BPS. Monthly data for SF/MF housing units.';
COMMENT ON TABLE permits_county IS 'County-level building permits from Census Bureau BPS. Monthly data for SF/MF housing units.';

COMMIT;

DO $$BEGIN RAISE NOTICE 'Migration 057 completed: Created permits_state, permits_metro, permits_county tables'; END $$;
