-- Migration: Create Zillow-Specific Data Tables
-- Purpose: Create separate tables for each Zillow data type for better organization
-- Date: 2025-11-16
--
-- This creates dedicated tables for:
-- - zillow_zhvi (Home Values)
-- - zillow_zori (Rentals)
-- - zillow_inventory (For-Sale Inventory)
-- - zillow_sales_count (Sales Count)
-- - zillow_sales_price (Median Sale Price)
-- - zillow_days_to_pending (Days to Pending)

-- ============================================================================
-- 1. Zillow Home Value Index (ZHVI)
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_zhvi (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    value DECIMAL(20, 4) NOT NULL,
    property_type VARCHAR(50),
    tier VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_zhvi_region_date ON zillow_zhvi(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_zhvi_date ON zillow_zhvi(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_zhvi_unique ON zillow_zhvi(region_id, date, property_type, tier);

-- ============================================================================
-- 2. Zillow Observed Rent Index (ZORI)
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_zori (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    value DECIMAL(20, 4) NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_zori_region_date ON zillow_zori(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_zori_date ON zillow_zori(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_zori_unique ON zillow_zori(region_id, date, property_type);

-- ============================================================================
-- 3. Zillow For-Sale Inventory
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_inventory (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    inventory_count INTEGER NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_inventory_region_date ON zillow_inventory(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_inventory_date ON zillow_inventory(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_inventory_unique ON zillow_inventory(region_id, date, property_type);

-- ============================================================================
-- 4. Zillow Sales Count
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_sales_count (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sales_count INTEGER NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_sales_count_region_date ON zillow_sales_count(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_sales_count_date ON zillow_sales_count(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_sales_count_unique ON zillow_sales_count(region_id, date, property_type);

-- ============================================================================
-- 5. Zillow Median Sale Price
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_sales_price (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    median_price DECIMAL(20, 4) NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_sales_price_region_date ON zillow_sales_price(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_sales_price_date ON zillow_sales_price(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_sales_price_unique ON zillow_sales_price(region_id, date, property_type);

-- ============================================================================
-- 6. Zillow Days to Pending
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_days_to_pending (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    days DECIMAL(10, 2) NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_days_pending_region_date ON zillow_days_to_pending(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_days_pending_date ON zillow_days_to_pending(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_days_pending_unique ON zillow_days_to_pending(region_id, date, property_type);

-- ============================================================================
-- Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_zhvi TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_zori TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_inventory TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_sales_count TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_sales_price TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_days_to_pending TO service_role;

GRANT SELECT ON TABLE zillow_zhvi TO anon, authenticated;
GRANT SELECT ON TABLE zillow_zori TO anon, authenticated;
GRANT SELECT ON TABLE zillow_inventory TO anon, authenticated;
GRANT SELECT ON TABLE zillow_sales_count TO anon, authenticated;
GRANT SELECT ON TABLE zillow_sales_price TO anon, authenticated;
GRANT SELECT ON TABLE zillow_days_to_pending TO anon, authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE zillow_zhvi_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_zori_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_inventory_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_sales_count_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_sales_price_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_days_to_pending_id_seq TO service_role;

-- Disable RLS
ALTER TABLE zillow_zhvi DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_zori DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_sales_count DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_sales_price DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_days_to_pending DISABLE ROW LEVEL SECURITY;

