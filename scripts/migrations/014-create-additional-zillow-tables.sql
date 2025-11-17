-- Migration: Create Additional Zillow Tables
-- Purpose: Create tables for Market Heat Index, New Construction, and Affordability data
-- Date: 2025-11-16

-- ============================================================================
-- 1. Zillow Market Heat Index
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_market_heat_index (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    heat_index DECIMAL(10, 4) NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_heat_index_region_date ON zillow_market_heat_index(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_heat_index_date ON zillow_market_heat_index(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_heat_index_unique ON zillow_market_heat_index(region_id, date, property_type);

-- ============================================================================
-- 2. Zillow New Construction Sales Count
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_new_construction_sales_count (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sales_count INTEGER NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_new_con_count_region_date ON zillow_new_construction_sales_count(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_new_con_count_date ON zillow_new_construction_sales_count(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_new_con_count_unique ON zillow_new_construction_sales_count(region_id, date, property_type);

-- ============================================================================
-- 3. Zillow New Construction Sale Price
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_new_construction_sale_price (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    median_price DECIMAL(20, 4),
    mean_price DECIMAL(20, 4),
    price_per_sqft DECIMAL(20, 4),
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_new_con_price_region_date ON zillow_new_construction_sale_price(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_new_con_price_date ON zillow_new_construction_sale_price(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_new_con_price_unique ON zillow_new_construction_sale_price(region_id, date, property_type);

-- ============================================================================
-- 4. Zillow Affordability Metrics
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_affordability (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    homeowner_income_needed DECIMAL(20, 2),
    renter_income_needed DECIMAL(20, 2),
    affordable_home_price DECIMAL(20, 2),
    years_to_save DECIMAL(10, 2),
    homeowner_affordability_percent DECIMAL(5, 2),
    renter_affordability_percent DECIMAL(5, 2),
    down_payment_percent DECIMAL(5, 2) DEFAULT 20.0,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_affordability_region_date ON zillow_affordability(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_affordability_date ON zillow_affordability(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_affordability_unique ON zillow_affordability(region_id, date, property_type, down_payment_percent);

-- ============================================================================
-- Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_market_heat_index TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_new_construction_sales_count TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_new_construction_sale_price TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_affordability TO service_role;

GRANT SELECT ON TABLE zillow_market_heat_index TO anon, authenticated;
GRANT SELECT ON TABLE zillow_new_construction_sales_count TO anon, authenticated;
GRANT SELECT ON TABLE zillow_new_construction_sale_price TO anon, authenticated;
GRANT SELECT ON TABLE zillow_affordability TO anon, authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE zillow_market_heat_index_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_new_construction_sales_count_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_new_construction_sale_price_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_affordability_id_seq TO service_role;

-- Disable RLS
ALTER TABLE zillow_market_heat_index DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_new_construction_sales_count DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_new_construction_sale_price DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_affordability DISABLE ROW LEVEL SECURITY;

