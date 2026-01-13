/**
 * Fix Zillow Tables
 * Drop and recreate the tables with correct schema
 *
 * This script needs to be run with the Supabase SQL editor or a database admin tool
 * because Supabase client doesn't support DDL statements directly.
 *
 * Outputs the SQL to run.
 */

const fixSQL = `
-- Fix Zillow Tables - Run this in Supabase SQL Editor

-- First, drop the incorrectly created tables (they're empty anyway)
DROP TABLE IF EXISTS zillow_new_listings CASCADE;
DROP TABLE IF EXISTS zillow_pending_listings CASCADE;
DROP TABLE IF EXISTS zillow_median_list_price CASCADE;
DROP TABLE IF EXISTS zillow_sale_to_list CASCADE;
DROP TABLE IF EXISTS zillow_days_to_close CASCADE;
DROP TABLE IF EXISTS zillow_price_cut_share CASCADE;
DROP TABLE IF EXISTS zillow_price_cut_amt CASCADE;
DROP TABLE IF EXISTS zillow_price_cut_pct CASCADE;

-- Recreate zillow_new_listings
CREATE TABLE zillow_new_listings (
    id BIGSERIAL PRIMARY KEY,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value INTEGER NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_zillow_new_listings_unique
    ON zillow_new_listings(region_id, date, property_type, geography);
CREATE INDEX idx_zillow_new_listings_region_date
    ON zillow_new_listings(region_id, date DESC);
CREATE INDEX idx_zillow_new_listings_geography_date
    ON zillow_new_listings(geography, date DESC);

-- Recreate zillow_pending_listings
CREATE TABLE zillow_pending_listings (
    id BIGSERIAL PRIMARY KEY,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value INTEGER NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_zillow_pending_listings_unique
    ON zillow_pending_listings(region_id, date, property_type, geography);
CREATE INDEX idx_zillow_pending_listings_region_date
    ON zillow_pending_listings(region_id, date DESC);
CREATE INDEX idx_zillow_pending_listings_geography_date
    ON zillow_pending_listings(geography, date DESC);

-- Recreate zillow_median_list_price
CREATE TABLE zillow_median_list_price (
    id BIGSERIAL PRIMARY KEY,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(20, 4) NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_zillow_median_list_price_unique
    ON zillow_median_list_price(region_id, date, property_type, geography);
CREATE INDEX idx_zillow_median_list_price_region_date
    ON zillow_median_list_price(region_id, date DESC);
CREATE INDEX idx_zillow_median_list_price_geography_date
    ON zillow_median_list_price(geography, date DESC);

-- Recreate zillow_sale_to_list
CREATE TABLE zillow_sale_to_list (
    id BIGSERIAL PRIMARY KEY,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(10, 6) NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_zillow_sale_to_list_unique
    ON zillow_sale_to_list(region_id, date, property_type, geography);
CREATE INDEX idx_zillow_sale_to_list_region_date
    ON zillow_sale_to_list(region_id, date DESC);
CREATE INDEX idx_zillow_sale_to_list_geography_date
    ON zillow_sale_to_list(geography, date DESC);

-- Recreate zillow_days_to_close
CREATE TABLE zillow_days_to_close (
    id BIGSERIAL PRIMARY KEY,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_zillow_days_to_close_unique
    ON zillow_days_to_close(region_id, date, property_type, geography);
CREATE INDEX idx_zillow_days_to_close_region_date
    ON zillow_days_to_close(region_id, date DESC);
CREATE INDEX idx_zillow_days_to_close_geography_date
    ON zillow_days_to_close(geography, date DESC);

-- Recreate zillow_price_cut_share
CREATE TABLE zillow_price_cut_share (
    id BIGSERIAL PRIMARY KEY,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(10, 6) NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_zillow_price_cut_share_unique
    ON zillow_price_cut_share(region_id, date, property_type, geography);
CREATE INDEX idx_zillow_price_cut_share_region_date
    ON zillow_price_cut_share(region_id, date DESC);
CREATE INDEX idx_zillow_price_cut_share_geography_date
    ON zillow_price_cut_share(geography, date DESC);

-- Recreate zillow_price_cut_amt
CREATE TABLE zillow_price_cut_amt (
    id BIGSERIAL PRIMARY KEY,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(20, 4) NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_zillow_price_cut_amt_unique
    ON zillow_price_cut_amt(region_id, date, property_type, geography);
CREATE INDEX idx_zillow_price_cut_amt_region_date
    ON zillow_price_cut_amt(region_id, date DESC);
CREATE INDEX idx_zillow_price_cut_amt_geography_date
    ON zillow_price_cut_amt(geography, date DESC);

-- Recreate zillow_price_cut_pct
CREATE TABLE zillow_price_cut_pct (
    id BIGSERIAL PRIMARY KEY,
    region_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(10, 6) NOT NULL,
    property_type VARCHAR(50),
    geography VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_zillow_price_cut_pct_unique
    ON zillow_price_cut_pct(region_id, date, property_type, geography);
CREATE INDEX idx_zillow_price_cut_pct_region_date
    ON zillow_price_cut_pct(region_id, date DESC);
CREATE INDEX idx_zillow_price_cut_pct_geography_date
    ON zillow_price_cut_pct(geography, date DESC);

-- Grant permissions
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

-- Disable RLS
ALTER TABLE zillow_new_listings DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_pending_listings DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_median_list_price DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_sale_to_list DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_days_to_close DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_price_cut_share DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_price_cut_amt DISABLE ROW LEVEL SECURITY;
ALTER TABLE zillow_price_cut_pct DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'zillow_%'
ORDER BY table_name;
`;

console.log('='.repeat(70));
console.log('FIX ZILLOW TABLES - SQL TO RUN IN SUPABASE');
console.log('='.repeat(70));
console.log();
console.log('Copy the SQL below and run it in the Supabase SQL Editor:');
console.log('1. Go to your Supabase project dashboard');
console.log('2. Click "SQL Editor" in the left sidebar');
console.log('3. Paste the SQL below and click "Run"');
console.log();
console.log('-'.repeat(70));
console.log(fixSQL);
console.log('-'.repeat(70));

// Also write to a file for easy copy
import * as fs from 'fs';
import * as path from 'path';

const outputPath = path.join(__dirname, 'fix-zillow-tables.sql');
fs.writeFileSync(outputPath, fixSQL);
console.log(`\nSQL also saved to: ${outputPath}`);
