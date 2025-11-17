-- Migration: Create Additional Zillow Tables (v2)
-- Purpose: Create tables for additional Zillow metrics
-- Date: 2025-11-16

-- ============================================================================
-- 1. Zillow New Listings
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_new_listings (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    new_listings_count INTEGER NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_new_listings_region_date ON zillow_new_listings(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_new_listings_date ON zillow_new_listings(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_new_listings_unique ON zillow_new_listings(region_id, date, property_type);

-- ============================================================================
-- 2. Zillow Newly Pending Listings
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_newly_pending_listings (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    newly_pending_count INTEGER NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_newly_pending_region_date ON zillow_newly_pending_listings(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_newly_pending_date ON zillow_newly_pending_listings(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_newly_pending_unique ON zillow_newly_pending_listings(region_id, date, property_type);

-- ============================================================================
-- 3. Zillow Median List Price
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_list_price (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    median_list_price DECIMAL(20, 4) NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_list_price_region_date ON zillow_list_price(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_list_price_date ON zillow_list_price(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_list_price_unique ON zillow_list_price(region_id, date, property_type);

-- ============================================================================
-- 4. Zillow Sale-to-List Ratio
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_sale_to_list_ratio (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    mean_ratio DECIMAL(10, 4),
    median_ratio DECIMAL(10, 4),
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_sale_list_ratio_region_date ON zillow_sale_to_list_ratio(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_sale_list_ratio_date ON zillow_sale_to_list_ratio(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_sale_list_ratio_unique ON zillow_sale_to_list_ratio(region_id, date, property_type);

-- ============================================================================
-- 5. Zillow Percent Above/Below List
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_sale_list_percent (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    percent_above_list DECIMAL(5, 2),
    percent_below_list DECIMAL(5, 2),
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_sale_list_percent_region_date ON zillow_sale_list_percent(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_sale_list_percent_date ON zillow_sale_list_percent(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_sale_list_percent_unique ON zillow_sale_list_percent(region_id, date, property_type);

-- ============================================================================
-- 6. Zillow Days to Close
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_days_to_close (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    mean_days DECIMAL(10, 2),
    median_days DECIMAL(10, 2),
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_days_close_region_date ON zillow_days_to_close(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_days_close_date ON zillow_days_to_close(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_days_close_unique ON zillow_days_to_close(region_id, date, property_type);

-- ============================================================================
-- 7. Zillow Price Cuts
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_price_cuts (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    share_with_price_cut DECIMAL(5, 2),
    mean_price_cut_dollars DECIMAL(20, 2),
    mean_price_cut_percent DECIMAL(5, 2),
    median_price_cut_dollars DECIMAL(20, 2),
    median_price_cut_percent DECIMAL(5, 2),
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_price_cuts_region_date ON zillow_price_cuts(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_price_cuts_date ON zillow_price_cuts(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_price_cuts_unique ON zillow_price_cuts(region_id, date, property_type);

-- ============================================================================
-- 8. Update zillow_sales_price to include mean_price
-- ============================================================================
ALTER TABLE zillow_sales_price ADD COLUMN IF NOT EXISTS mean_price DECIMAL(20, 4);

-- ============================================================================
-- 9. Zillow Total Transaction Value
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_total_transaction_value (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL REFERENCES markets(region_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_value DECIMAL(20, 2) NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, date)
);

CREATE INDEX IF NOT EXISTS idx_zillow_transaction_value_region_date ON zillow_total_transaction_value(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_transaction_value_date ON zillow_total_transaction_value(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_transaction_value_unique ON zillow_total_transaction_value(region_id, date, property_type);

-- ============================================================================
-- Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_new_listings TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_newly_pending_listings TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_list_price TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_sale_to_list_ratio TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_sale_list_percent TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_days_to_close TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_price_cuts TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE zillow_total_transaction_value TO service_role;

GRANT SELECT ON TABLE zillow_new_listings TO anon, authenticated;
GRANT SELECT ON TABLE zillow_newly_pending_listings TO anon, authenticated;
GRANT SELECT ON TABLE zillow_list_price TO anon, authenticated;
GRANT SELECT ON TABLE zillow_sale_to_list_ratio TO anon, authenticated;
GRANT SELECT ON TABLE zillow_sale_list_percent TO anon, authenticated;
GRANT SELECT ON TABLE zillow_days_to_close TO anon, authenticated;
GRANT SELECT ON TABLE zillow_price_cuts TO anon, authenticated;
GRANT SELECT ON TABLE zillow_total_transaction_value TO anon, authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE zillow_new_listings_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_newly_pending_listings_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_list_price_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_sale_to_list_ratio_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_sale_list_percent_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_days_to_close_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_price_cuts_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_total_transaction_value_id_seq TO service_role;

-- Disable RLS
ALTER TABLE zillow_new_listings DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_newly_pending_listings DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_list_price DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_sale_to_list_ratio DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_sale_list_percent DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_days_to_close DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_price_cuts DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_total_transaction_value DISABLE ROW LEVEL SECURITY;

