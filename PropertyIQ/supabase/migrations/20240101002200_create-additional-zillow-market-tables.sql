-- Migration: Create Additional Zillow Market Tables
-- Purpose: Create tables for New Listings, Pending Listings, List Price, Sale-to-List,
--          Days to Close, Price Cuts, and Infrastructure Tables
-- Date: 2026-01-11
--
-- This completes the Zillow data pipeline by adding tables for:
-- 1. New Listings
-- 2. Pending Listings (Newly Pending)
-- 3. Median List Price
-- 4. Sale-to-List Ratio
-- 5. Days to Close
-- 6. Price Cut Share (% of listings with price cut)
-- 7. Price Cut Amount ($)
-- 8. Price Cut Percent (%)
-- 9. Data Ingestion Log (infrastructure)
-- 10. Data Source Registry (infrastructure)

-- ============================================================================
-- 1. Zillow New Listings
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_new_listings (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value INTEGER NOT NULL,                -- Count of new listings
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_zillow_new_listings_region_date
    ON zillow_new_listings(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_new_listings_geography_date
    ON zillow_new_listings(geography, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_new_listings_date
    ON zillow_new_listings(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_new_listings_unique
    ON zillow_new_listings(region_id, date, property_type, geography);

-- ============================================================================
-- 2. Zillow Pending Listings (Newly Pending)
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_pending_listings (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value INTEGER NOT NULL,                -- Count of listings that went pending
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_zillow_pending_listings_region_date
    ON zillow_pending_listings(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_pending_listings_geography_date
    ON zillow_pending_listings(geography, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_pending_listings_date
    ON zillow_pending_listings(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_pending_listings_unique
    ON zillow_pending_listings(region_id, date, property_type, geography);

-- ============================================================================
-- 3. Zillow Median List Price
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_median_list_price (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(20, 4) NOT NULL,         -- Median list price in dollars
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_zillow_median_list_price_region_date
    ON zillow_median_list_price(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_median_list_price_geography_date
    ON zillow_median_list_price(geography, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_median_list_price_date
    ON zillow_median_list_price(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_median_list_price_unique
    ON zillow_median_list_price(region_id, date, property_type, geography);

-- ============================================================================
-- 4. Zillow Sale-to-List Ratio
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_sale_to_list (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(10, 6) NOT NULL,         -- Ratio (e.g., 0.985 = 98.5%)
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_zillow_sale_to_list_region_date
    ON zillow_sale_to_list(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_sale_to_list_geography_date
    ON zillow_sale_to_list(geography, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_sale_to_list_date
    ON zillow_sale_to_list(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_sale_to_list_unique
    ON zillow_sale_to_list(region_id, date, property_type, geography);

-- ============================================================================
-- 5. Zillow Days to Close
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_days_to_close (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(10, 2) NOT NULL,         -- Number of days (median)
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_zillow_days_to_close_region_date
    ON zillow_days_to_close(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_days_to_close_geography_date
    ON zillow_days_to_close(geography, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_days_to_close_date
    ON zillow_days_to_close(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_days_to_close_unique
    ON zillow_days_to_close(region_id, date, property_type, geography);

-- ============================================================================
-- 6. Zillow Price Cut Share (% of listings with price cut)
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_price_cut_share (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(10, 6) NOT NULL,         -- Percentage as decimal (0.15 = 15%)
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_zillow_price_cut_share_region_date
    ON zillow_price_cut_share(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_price_cut_share_geography_date
    ON zillow_price_cut_share(geography, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_price_cut_share_date
    ON zillow_price_cut_share(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_price_cut_share_unique
    ON zillow_price_cut_share(region_id, date, property_type, geography);

-- ============================================================================
-- 7. Zillow Median Price Cut Amount ($)
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_price_cut_amt (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(20, 4) NOT NULL,         -- Dollar amount of price cut
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_zillow_price_cut_amt_region_date
    ON zillow_price_cut_amt(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_price_cut_amt_geography_date
    ON zillow_price_cut_amt(geography, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_price_cut_amt_date
    ON zillow_price_cut_amt(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_price_cut_amt_unique
    ON zillow_price_cut_amt(region_id, date, property_type, geography);

-- ============================================================================
-- 8. Zillow Median Price Cut Percent (%)
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_price_cut_pct (
    id BIGSERIAL,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(10, 6) NOT NULL,         -- Percentage as decimal
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_zillow_price_cut_pct_region_date
    ON zillow_price_cut_pct(region_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_price_cut_pct_geography_date
    ON zillow_price_cut_pct(geography, date DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_price_cut_pct_date
    ON zillow_price_cut_pct(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zillow_price_cut_pct_unique
    ON zillow_price_cut_pct(region_id, date, property_type, geography);

-- ============================================================================
-- 9. Data Ingestion Log (Infrastructure)
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_ingestion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,                  -- e.g., 'zillow', 'fred', 'census'
    table_name TEXT NOT NULL,
    metric_name TEXT,
    dataset_id TEXT,                       -- Reference to dataset config ID
    records_processed INTEGER DEFAULT 0,
    records_success INTEGER DEFAULT 0,
    records_error INTEGER DEFAULT 0,
    status TEXT NOT NULL,                  -- 'running', 'success', 'partial', 'failed'
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_source
    ON data_ingestion_log(source);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_table
    ON data_ingestion_log(table_name);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_status
    ON data_ingestion_log(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_completed
    ON data_ingestion_log(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_dataset
    ON data_ingestion_log(dataset_id);

-- ============================================================================
-- 10. Data Source Registry (Infrastructure)
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_source_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL,             -- e.g., 'zillow'
    dataset_id TEXT NOT NULL UNIQUE,       -- e.g., 'zhvi-metro-all-homes-sm-sa'
    table_name TEXT NOT NULL,
    source_url TEXT,
    update_frequency TEXT DEFAULT 'monthly',
    last_successful_ingestion TIMESTAMPTZ,
    next_scheduled_ingestion TIMESTAMPTZ,
    records_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,                        -- Store additional config info
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_registry_source
    ON data_source_registry(source_name);
CREATE INDEX IF NOT EXISTS idx_source_registry_table
    ON data_source_registry(table_name);
CREATE INDEX IF NOT EXISTS idx_source_registry_active
    ON data_source_registry(is_active);

-- ============================================================================
-- Grant Permissions - Metric Tables
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE zillow_new_listings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE zillow_pending_listings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE zillow_median_list_price TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE zillow_sale_to_list TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE zillow_days_to_close TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE zillow_price_cut_share TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE zillow_price_cut_amt TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE zillow_price_cut_pct TO service_role;

GRANT SELECT ON TABLE zillow_new_listings TO anon, authenticated;
GRANT SELECT ON TABLE zillow_pending_listings TO anon, authenticated;
GRANT SELECT ON TABLE zillow_median_list_price TO anon, authenticated;
GRANT SELECT ON TABLE zillow_sale_to_list TO anon, authenticated;
GRANT SELECT ON TABLE zillow_days_to_close TO anon, authenticated;
GRANT SELECT ON TABLE zillow_price_cut_share TO anon, authenticated;
GRANT SELECT ON TABLE zillow_price_cut_amt TO anon, authenticated;
GRANT SELECT ON TABLE zillow_price_cut_pct TO anon, authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE zillow_new_listings_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_pending_listings_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_median_list_price_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_sale_to_list_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_days_to_close_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_price_cut_share_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_price_cut_amt_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zillow_price_cut_pct_id_seq TO service_role;

-- ============================================================================
-- Grant Permissions - Infrastructure Tables
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE data_ingestion_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE data_source_registry TO service_role;

GRANT SELECT ON TABLE data_ingestion_log TO anon, authenticated;
GRANT SELECT ON TABLE data_source_registry TO anon, authenticated;

-- ============================================================================
-- Disable RLS for simpler access
-- ============================================================================
ALTER TABLE zillow_new_listings DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_pending_listings DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_median_list_price DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_sale_to_list DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_days_to_close DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_price_cut_share DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_price_cut_amt DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_price_cut_pct DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_ingestion_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_registry DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Add updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all new tables
DROP TRIGGER IF EXISTS trigger_zillow_new_listings_updated_at ON zillow_new_listings;
CREATE TRIGGER trigger_zillow_new_listings_updated_at
    BEFORE UPDATE ON zillow_new_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_zillow_pending_listings_updated_at ON zillow_pending_listings;
CREATE TRIGGER trigger_zillow_pending_listings_updated_at
    BEFORE UPDATE ON zillow_pending_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_zillow_median_list_price_updated_at ON zillow_median_list_price;
CREATE TRIGGER trigger_zillow_median_list_price_updated_at
    BEFORE UPDATE ON zillow_median_list_price
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_zillow_sale_to_list_updated_at ON zillow_sale_to_list;
CREATE TRIGGER trigger_zillow_sale_to_list_updated_at
    BEFORE UPDATE ON zillow_sale_to_list
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_zillow_days_to_close_updated_at ON zillow_days_to_close;
CREATE TRIGGER trigger_zillow_days_to_close_updated_at
    BEFORE UPDATE ON zillow_days_to_close
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_zillow_price_cut_share_updated_at ON zillow_price_cut_share;
CREATE TRIGGER trigger_zillow_price_cut_share_updated_at
    BEFORE UPDATE ON zillow_price_cut_share
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_zillow_price_cut_amt_updated_at ON zillow_price_cut_amt;
CREATE TRIGGER trigger_zillow_price_cut_amt_updated_at
    BEFORE UPDATE ON zillow_price_cut_amt
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_zillow_price_cut_pct_updated_at ON zillow_price_cut_pct;
CREATE TRIGGER trigger_zillow_price_cut_pct_updated_at
    BEFORE UPDATE ON zillow_price_cut_pct
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_data_source_registry_updated_at ON data_source_registry;
CREATE TRIGGER trigger_data_source_registry_updated_at
    BEFORE UPDATE ON data_source_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE zillow_new_listings IS 'Count of new listings coming on market';
COMMENT ON TABLE zillow_pending_listings IS 'Count of listings that changed to pending status';
COMMENT ON TABLE zillow_median_list_price IS 'Median price at which homes were listed';
COMMENT ON TABLE zillow_sale_to_list IS 'Ratio of sale price vs. final list price';
COMMENT ON TABLE zillow_days_to_close IS 'Days between listing going pending and sale date';
COMMENT ON TABLE zillow_price_cut_share IS 'Share of listings with a price reduction';
COMMENT ON TABLE zillow_price_cut_amt IS 'Median price cut in dollars';
COMMENT ON TABLE zillow_price_cut_pct IS 'Median price cut as percentage of list price';
COMMENT ON TABLE data_ingestion_log IS 'Tracks all data ingestion runs with status and metrics';
COMMENT ON TABLE data_source_registry IS 'Registry of all data sources and their update schedules';
