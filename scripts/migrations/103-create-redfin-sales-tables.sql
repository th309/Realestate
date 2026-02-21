-- Migration 103: Create Redfin sales/market tracker tables for housing market data
-- Data sourced from Redfin Data Center (https://www.redfin.com/news/data-center/)
-- Follows the source_geography naming pattern (e.g., redfin_national, redfin_metro)
-- 7 geography levels: national, state, metro, county, city, zip, neighborhood

BEGIN;

-- ============================================================================
-- 1. CREATE REDFIN NATIONAL TABLE
-- ============================================================================

CREATE TABLE redfin_national (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_begin DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Redfin internal identifier
    redfin_table_id INTEGER,

    -- Property type filter
    property_type VARCHAR(50) NOT NULL,

    -- Sale price metrics
    median_sale_price DECIMAL,
    median_sale_price_mom DECIMAL,
    median_sale_price_yoy DECIMAL,

    -- List price metrics
    median_list_price DECIMAL,
    median_list_price_mom DECIMAL,
    median_list_price_yoy DECIMAL,

    -- Sale price per square foot
    median_ppsf DECIMAL,
    median_ppsf_mom DECIMAL,
    median_ppsf_yoy DECIMAL,

    -- List price per square foot
    median_list_ppsf DECIMAL,
    median_list_ppsf_mom DECIMAL,
    median_list_ppsf_yoy DECIMAL,

    -- Homes sold
    homes_sold DECIMAL,
    homes_sold_mom DECIMAL,
    homes_sold_yoy DECIMAL,

    -- Pending sales
    pending_sales DECIMAL,
    pending_sales_mom DECIMAL,
    pending_sales_yoy DECIMAL,

    -- New listings
    new_listings DECIMAL,
    new_listings_mom DECIMAL,
    new_listings_yoy DECIMAL,

    -- Inventory
    inventory DECIMAL,
    inventory_mom DECIMAL,
    inventory_yoy DECIMAL,

    -- Months of supply
    months_of_supply DECIMAL,
    months_of_supply_mom DECIMAL,
    months_of_supply_yoy DECIMAL,

    -- Median days on market
    median_dom DECIMAL,
    median_dom_mom DECIMAL,
    median_dom_yoy DECIMAL,

    -- Average sale-to-list ratio
    avg_sale_to_list DECIMAL,
    avg_sale_to_list_mom DECIMAL,
    avg_sale_to_list_yoy DECIMAL,

    -- Sold above list percentage
    sold_above_list DECIMAL,
    sold_above_list_mom DECIMAL,
    sold_above_list_yoy DECIMAL,

    -- Price drops percentage
    price_drops DECIMAL,
    price_drops_mom DECIMAL,
    price_drops_yoy DECIMAL,

    -- Off market in two weeks percentage
    off_market_in_two_weeks DECIMAL,
    off_market_in_two_weeks_mom DECIMAL,
    off_market_in_two_weeks_yoy DECIMAL,

    -- Parent metro reference (not applicable for national)
    parent_metro_region VARCHAR(200),
    parent_metro_region_metro_code VARCHAR(10),

    -- Timestamps
    last_updated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    CONSTRAINT redfin_national_unique UNIQUE (period_end, property_type)
);

CREATE INDEX idx_redfin_national_period ON redfin_national(period_end DESC);
CREATE INDEX idx_redfin_national_property_type ON redfin_national(property_type);

-- ============================================================================
-- 2. CREATE REDFIN STATE TABLE
-- ============================================================================

CREATE TABLE redfin_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_begin DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Geographic identifiers
    state_code VARCHAR(2) NOT NULL,
    state_name VARCHAR(50),
    state_fips VARCHAR(2),              -- Standard FIPS code (e.g., '04' for AZ), derived from state_code
    redfin_table_id INTEGER,            -- Redfin internal region ID

    -- Property type filter
    property_type VARCHAR(50) NOT NULL,

    -- Sale price metrics
    median_sale_price DECIMAL,
    median_sale_price_mom DECIMAL,
    median_sale_price_yoy DECIMAL,

    -- List price metrics
    median_list_price DECIMAL,
    median_list_price_mom DECIMAL,
    median_list_price_yoy DECIMAL,

    -- Sale price per square foot
    median_ppsf DECIMAL,
    median_ppsf_mom DECIMAL,
    median_ppsf_yoy DECIMAL,

    -- List price per square foot
    median_list_ppsf DECIMAL,
    median_list_ppsf_mom DECIMAL,
    median_list_ppsf_yoy DECIMAL,

    -- Homes sold
    homes_sold DECIMAL,
    homes_sold_mom DECIMAL,
    homes_sold_yoy DECIMAL,

    -- Pending sales
    pending_sales DECIMAL,
    pending_sales_mom DECIMAL,
    pending_sales_yoy DECIMAL,

    -- New listings
    new_listings DECIMAL,
    new_listings_mom DECIMAL,
    new_listings_yoy DECIMAL,

    -- Inventory
    inventory DECIMAL,
    inventory_mom DECIMAL,
    inventory_yoy DECIMAL,

    -- Months of supply
    months_of_supply DECIMAL,
    months_of_supply_mom DECIMAL,
    months_of_supply_yoy DECIMAL,

    -- Median days on market
    median_dom DECIMAL,
    median_dom_mom DECIMAL,
    median_dom_yoy DECIMAL,

    -- Average sale-to-list ratio
    avg_sale_to_list DECIMAL,
    avg_sale_to_list_mom DECIMAL,
    avg_sale_to_list_yoy DECIMAL,

    -- Sold above list percentage
    sold_above_list DECIMAL,
    sold_above_list_mom DECIMAL,
    sold_above_list_yoy DECIMAL,

    -- Price drops percentage
    price_drops DECIMAL,
    price_drops_mom DECIMAL,
    price_drops_yoy DECIMAL,

    -- Off market in two weeks percentage
    off_market_in_two_weeks DECIMAL,
    off_market_in_two_weeks_mom DECIMAL,
    off_market_in_two_weeks_yoy DECIMAL,

    -- Parent metro reference
    parent_metro_region VARCHAR(200),
    parent_metro_region_metro_code VARCHAR(10),

    -- Timestamps
    last_updated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    CONSTRAINT redfin_state_unique UNIQUE (period_end, state_code, property_type)
);

CREATE INDEX idx_redfin_state_period ON redfin_state(period_end DESC);
CREATE INDEX idx_redfin_state_code ON redfin_state(state_code);
CREATE INDEX idx_redfin_state_fips ON redfin_state(state_fips);
CREATE INDEX idx_redfin_state_combo ON redfin_state(state_code, period_end DESC);
CREATE INDEX idx_redfin_state_property_type ON redfin_state(property_type);

-- ============================================================================
-- 3. CREATE REDFIN METRO TABLE
-- ============================================================================

CREATE TABLE redfin_metro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_begin DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Geographic identifiers
    region_name VARCHAR(200) NOT NULL,
    cbsa_code VARCHAR(10),              -- Standard CBSA code, directly from TABLE_ID (e.g., '38060' for Phoenix)
    redfin_table_id INTEGER,            -- Same as cbsa_code for metros, stored for consistency

    -- Property type filter
    property_type VARCHAR(50) NOT NULL,

    -- Sale price metrics
    median_sale_price DECIMAL,
    median_sale_price_mom DECIMAL,
    median_sale_price_yoy DECIMAL,

    -- List price metrics
    median_list_price DECIMAL,
    median_list_price_mom DECIMAL,
    median_list_price_yoy DECIMAL,

    -- Sale price per square foot
    median_ppsf DECIMAL,
    median_ppsf_mom DECIMAL,
    median_ppsf_yoy DECIMAL,

    -- List price per square foot
    median_list_ppsf DECIMAL,
    median_list_ppsf_mom DECIMAL,
    median_list_ppsf_yoy DECIMAL,

    -- Homes sold
    homes_sold DECIMAL,
    homes_sold_mom DECIMAL,
    homes_sold_yoy DECIMAL,

    -- Pending sales
    pending_sales DECIMAL,
    pending_sales_mom DECIMAL,
    pending_sales_yoy DECIMAL,

    -- New listings
    new_listings DECIMAL,
    new_listings_mom DECIMAL,
    new_listings_yoy DECIMAL,

    -- Inventory
    inventory DECIMAL,
    inventory_mom DECIMAL,
    inventory_yoy DECIMAL,

    -- Months of supply
    months_of_supply DECIMAL,
    months_of_supply_mom DECIMAL,
    months_of_supply_yoy DECIMAL,

    -- Median days on market
    median_dom DECIMAL,
    median_dom_mom DECIMAL,
    median_dom_yoy DECIMAL,

    -- Average sale-to-list ratio
    avg_sale_to_list DECIMAL,
    avg_sale_to_list_mom DECIMAL,
    avg_sale_to_list_yoy DECIMAL,

    -- Sold above list percentage
    sold_above_list DECIMAL,
    sold_above_list_mom DECIMAL,
    sold_above_list_yoy DECIMAL,

    -- Price drops percentage
    price_drops DECIMAL,
    price_drops_mom DECIMAL,
    price_drops_yoy DECIMAL,

    -- Off market in two weeks percentage
    off_market_in_two_weeks DECIMAL,
    off_market_in_two_weeks_mom DECIMAL,
    off_market_in_two_weeks_yoy DECIMAL,

    -- Parent metro reference
    parent_metro_region VARCHAR(200),
    parent_metro_region_metro_code VARCHAR(10),

    -- Timestamps
    last_updated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    CONSTRAINT redfin_metro_unique UNIQUE (period_end, region_name, property_type)
);

CREATE INDEX idx_redfin_metro_period ON redfin_metro(period_end DESC);
CREATE INDEX idx_redfin_metro_region ON redfin_metro(region_name);
CREATE INDEX idx_redfin_metro_cbsa ON redfin_metro(cbsa_code);
CREATE INDEX idx_redfin_metro_combo ON redfin_metro(region_name, period_end DESC);
CREATE INDEX idx_redfin_metro_property_type ON redfin_metro(property_type);

-- ============================================================================
-- 4. CREATE REDFIN COUNTY TABLE
-- ============================================================================

CREATE TABLE redfin_county (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_begin DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Geographic identifiers
    county_name VARCHAR(200) NOT NULL,
    state_code VARCHAR(2),
    fips_code VARCHAR(5),               -- Standard county FIPS (e.g., '04013'), populated via post-import lookup
    redfin_table_id INTEGER,            -- Redfin internal region ID (NOT the FIPS code)

    -- Property type filter
    property_type VARCHAR(50) NOT NULL,

    -- Sale price metrics
    median_sale_price DECIMAL,
    median_sale_price_mom DECIMAL,
    median_sale_price_yoy DECIMAL,

    -- List price metrics
    median_list_price DECIMAL,
    median_list_price_mom DECIMAL,
    median_list_price_yoy DECIMAL,

    -- Sale price per square foot
    median_ppsf DECIMAL,
    median_ppsf_mom DECIMAL,
    median_ppsf_yoy DECIMAL,

    -- List price per square foot
    median_list_ppsf DECIMAL,
    median_list_ppsf_mom DECIMAL,
    median_list_ppsf_yoy DECIMAL,

    -- Homes sold
    homes_sold DECIMAL,
    homes_sold_mom DECIMAL,
    homes_sold_yoy DECIMAL,

    -- Pending sales
    pending_sales DECIMAL,
    pending_sales_mom DECIMAL,
    pending_sales_yoy DECIMAL,

    -- New listings
    new_listings DECIMAL,
    new_listings_mom DECIMAL,
    new_listings_yoy DECIMAL,

    -- Inventory
    inventory DECIMAL,
    inventory_mom DECIMAL,
    inventory_yoy DECIMAL,

    -- Months of supply
    months_of_supply DECIMAL,
    months_of_supply_mom DECIMAL,
    months_of_supply_yoy DECIMAL,

    -- Median days on market
    median_dom DECIMAL,
    median_dom_mom DECIMAL,
    median_dom_yoy DECIMAL,

    -- Average sale-to-list ratio
    avg_sale_to_list DECIMAL,
    avg_sale_to_list_mom DECIMAL,
    avg_sale_to_list_yoy DECIMAL,

    -- Sold above list percentage
    sold_above_list DECIMAL,
    sold_above_list_mom DECIMAL,
    sold_above_list_yoy DECIMAL,

    -- Price drops percentage
    price_drops DECIMAL,
    price_drops_mom DECIMAL,
    price_drops_yoy DECIMAL,

    -- Off market in two weeks percentage
    off_market_in_two_weeks DECIMAL,
    off_market_in_two_weeks_mom DECIMAL,
    off_market_in_two_weeks_yoy DECIMAL,

    -- Parent metro reference
    parent_metro_region VARCHAR(200),
    parent_metro_region_metro_code VARCHAR(10),

    -- Timestamps
    last_updated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    CONSTRAINT redfin_county_unique UNIQUE (period_end, county_name, state_code, property_type)
);

CREATE INDEX idx_redfin_county_period ON redfin_county(period_end DESC);
CREATE INDEX idx_redfin_county_name ON redfin_county(county_name);
CREATE INDEX idx_redfin_county_fips ON redfin_county(fips_code);
CREATE INDEX idx_redfin_county_combo ON redfin_county(county_name, state_code, period_end DESC);
CREATE INDEX idx_redfin_county_property_type ON redfin_county(property_type);

-- ============================================================================
-- 5. CREATE REDFIN CITY TABLE
-- ============================================================================

CREATE TABLE redfin_city (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_begin DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Geographic identifiers
    city_name VARCHAR(100) NOT NULL,
    state_code VARCHAR(2),
    place_fips VARCHAR(7),              -- Census Place FIPS (e.g., '0455000'), populated via post-import lookup
    redfin_table_id INTEGER,            -- Redfin internal region ID

    -- Property type filter
    property_type VARCHAR(50) NOT NULL,

    -- Sale price metrics
    median_sale_price DECIMAL,
    median_sale_price_mom DECIMAL,
    median_sale_price_yoy DECIMAL,

    -- List price metrics
    median_list_price DECIMAL,
    median_list_price_mom DECIMAL,
    median_list_price_yoy DECIMAL,

    -- Sale price per square foot
    median_ppsf DECIMAL,
    median_ppsf_mom DECIMAL,
    median_ppsf_yoy DECIMAL,

    -- List price per square foot
    median_list_ppsf DECIMAL,
    median_list_ppsf_mom DECIMAL,
    median_list_ppsf_yoy DECIMAL,

    -- Homes sold
    homes_sold DECIMAL,
    homes_sold_mom DECIMAL,
    homes_sold_yoy DECIMAL,

    -- Pending sales
    pending_sales DECIMAL,
    pending_sales_mom DECIMAL,
    pending_sales_yoy DECIMAL,

    -- New listings
    new_listings DECIMAL,
    new_listings_mom DECIMAL,
    new_listings_yoy DECIMAL,

    -- Inventory
    inventory DECIMAL,
    inventory_mom DECIMAL,
    inventory_yoy DECIMAL,

    -- Months of supply
    months_of_supply DECIMAL,
    months_of_supply_mom DECIMAL,
    months_of_supply_yoy DECIMAL,

    -- Median days on market
    median_dom DECIMAL,
    median_dom_mom DECIMAL,
    median_dom_yoy DECIMAL,

    -- Average sale-to-list ratio
    avg_sale_to_list DECIMAL,
    avg_sale_to_list_mom DECIMAL,
    avg_sale_to_list_yoy DECIMAL,

    -- Sold above list percentage
    sold_above_list DECIMAL,
    sold_above_list_mom DECIMAL,
    sold_above_list_yoy DECIMAL,

    -- Price drops percentage
    price_drops DECIMAL,
    price_drops_mom DECIMAL,
    price_drops_yoy DECIMAL,

    -- Off market in two weeks percentage
    off_market_in_two_weeks DECIMAL,
    off_market_in_two_weeks_mom DECIMAL,
    off_market_in_two_weeks_yoy DECIMAL,

    -- Parent metro reference
    parent_metro_region VARCHAR(200),
    parent_metro_region_metro_code VARCHAR(10),

    -- Timestamps
    last_updated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    CONSTRAINT redfin_city_unique UNIQUE (period_end, city_name, state_code, property_type)
);

CREATE INDEX idx_redfin_city_period ON redfin_city(period_end DESC);
CREATE INDEX idx_redfin_city_name ON redfin_city(city_name);
CREATE INDEX idx_redfin_city_combo ON redfin_city(city_name, state_code, period_end DESC);
CREATE INDEX idx_redfin_city_property_type ON redfin_city(property_type);

-- ============================================================================
-- 6. CREATE REDFIN ZIP TABLE
-- ============================================================================

CREATE TABLE redfin_zip (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_begin DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Geographic identifiers
    zip_code VARCHAR(5) NOT NULL,
    state_code VARCHAR(2),
    redfin_table_id INTEGER,            -- Redfin internal region ID

    -- Property type filter
    property_type VARCHAR(50) NOT NULL,

    -- Sale price metrics
    median_sale_price DECIMAL,
    median_sale_price_mom DECIMAL,
    median_sale_price_yoy DECIMAL,

    -- List price metrics
    median_list_price DECIMAL,
    median_list_price_mom DECIMAL,
    median_list_price_yoy DECIMAL,

    -- Sale price per square foot
    median_ppsf DECIMAL,
    median_ppsf_mom DECIMAL,
    median_ppsf_yoy DECIMAL,

    -- List price per square foot
    median_list_ppsf DECIMAL,
    median_list_ppsf_mom DECIMAL,
    median_list_ppsf_yoy DECIMAL,

    -- Homes sold
    homes_sold DECIMAL,
    homes_sold_mom DECIMAL,
    homes_sold_yoy DECIMAL,

    -- Pending sales
    pending_sales DECIMAL,
    pending_sales_mom DECIMAL,
    pending_sales_yoy DECIMAL,

    -- New listings
    new_listings DECIMAL,
    new_listings_mom DECIMAL,
    new_listings_yoy DECIMAL,

    -- Inventory
    inventory DECIMAL,
    inventory_mom DECIMAL,
    inventory_yoy DECIMAL,

    -- Months of supply
    months_of_supply DECIMAL,
    months_of_supply_mom DECIMAL,
    months_of_supply_yoy DECIMAL,

    -- Median days on market
    median_dom DECIMAL,
    median_dom_mom DECIMAL,
    median_dom_yoy DECIMAL,

    -- Average sale-to-list ratio
    avg_sale_to_list DECIMAL,
    avg_sale_to_list_mom DECIMAL,
    avg_sale_to_list_yoy DECIMAL,

    -- Sold above list percentage
    sold_above_list DECIMAL,
    sold_above_list_mom DECIMAL,
    sold_above_list_yoy DECIMAL,

    -- Price drops percentage
    price_drops DECIMAL,
    price_drops_mom DECIMAL,
    price_drops_yoy DECIMAL,

    -- Off market in two weeks percentage
    off_market_in_two_weeks DECIMAL,
    off_market_in_two_weeks_mom DECIMAL,
    off_market_in_two_weeks_yoy DECIMAL,

    -- Parent metro reference
    parent_metro_region VARCHAR(200),
    parent_metro_region_metro_code VARCHAR(10),

    -- Timestamps
    last_updated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    CONSTRAINT redfin_zip_unique UNIQUE (period_end, zip_code, property_type)
);

CREATE INDEX idx_redfin_zip_period ON redfin_zip(period_end DESC);
CREATE INDEX idx_redfin_zip_code ON redfin_zip(zip_code);
CREATE INDEX idx_redfin_zip_combo ON redfin_zip(zip_code, period_end DESC);
CREATE INDEX idx_redfin_zip_property_type ON redfin_zip(property_type);

-- ============================================================================
-- 7. CREATE REDFIN NEIGHBORHOOD TABLE
-- ============================================================================

CREATE TABLE redfin_neighborhood (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_begin DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Geographic identifiers
    neighborhood_name VARCHAR(200) NOT NULL,
    city VARCHAR(100),
    state_code VARCHAR(2),
    redfin_table_id INTEGER,            -- Redfin internal region ID

    -- Property type filter
    property_type VARCHAR(50) NOT NULL,

    -- Sale price metrics
    median_sale_price DECIMAL,
    median_sale_price_mom DECIMAL,
    median_sale_price_yoy DECIMAL,

    -- List price metrics
    median_list_price DECIMAL,
    median_list_price_mom DECIMAL,
    median_list_price_yoy DECIMAL,

    -- Sale price per square foot
    median_ppsf DECIMAL,
    median_ppsf_mom DECIMAL,
    median_ppsf_yoy DECIMAL,

    -- List price per square foot
    median_list_ppsf DECIMAL,
    median_list_ppsf_mom DECIMAL,
    median_list_ppsf_yoy DECIMAL,

    -- Homes sold
    homes_sold DECIMAL,
    homes_sold_mom DECIMAL,
    homes_sold_yoy DECIMAL,

    -- Pending sales
    pending_sales DECIMAL,
    pending_sales_mom DECIMAL,
    pending_sales_yoy DECIMAL,

    -- New listings
    new_listings DECIMAL,
    new_listings_mom DECIMAL,
    new_listings_yoy DECIMAL,

    -- Inventory
    inventory DECIMAL,
    inventory_mom DECIMAL,
    inventory_yoy DECIMAL,

    -- Months of supply
    months_of_supply DECIMAL,
    months_of_supply_mom DECIMAL,
    months_of_supply_yoy DECIMAL,

    -- Median days on market
    median_dom DECIMAL,
    median_dom_mom DECIMAL,
    median_dom_yoy DECIMAL,

    -- Average sale-to-list ratio
    avg_sale_to_list DECIMAL,
    avg_sale_to_list_mom DECIMAL,
    avg_sale_to_list_yoy DECIMAL,

    -- Sold above list percentage
    sold_above_list DECIMAL,
    sold_above_list_mom DECIMAL,
    sold_above_list_yoy DECIMAL,

    -- Price drops percentage
    price_drops DECIMAL,
    price_drops_mom DECIMAL,
    price_drops_yoy DECIMAL,

    -- Off market in two weeks percentage
    off_market_in_two_weeks DECIMAL,
    off_market_in_two_weeks_mom DECIMAL,
    off_market_in_two_weeks_yoy DECIMAL,

    -- Parent metro reference
    parent_metro_region VARCHAR(200),
    parent_metro_region_metro_code VARCHAR(10),

    -- Timestamps
    last_updated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    CONSTRAINT redfin_neighborhood_unique UNIQUE (period_end, neighborhood_name, city, state_code, property_type)
);

CREATE INDEX idx_redfin_neighborhood_period ON redfin_neighborhood(period_end DESC);
CREATE INDEX idx_redfin_neighborhood_name ON redfin_neighborhood(neighborhood_name);
CREATE INDEX idx_redfin_neighborhood_combo ON redfin_neighborhood(neighborhood_name, city, state_code, period_end DESC);
CREATE INDEX idx_redfin_neighborhood_property_type ON redfin_neighborhood(property_type);

-- ============================================================================
-- 8. ENABLE RLS AND ADD POLICIES
-- ============================================================================

ALTER TABLE redfin_national ENABLE ROW LEVEL SECURITY;
ALTER TABLE redfin_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE redfin_metro ENABLE ROW LEVEL SECURITY;
ALTER TABLE redfin_county ENABLE ROW LEVEL SECURITY;
ALTER TABLE redfin_city ENABLE ROW LEVEL SECURITY;
ALTER TABLE redfin_zip ENABLE ROW LEVEL SECURITY;
ALTER TABLE redfin_neighborhood ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read redfin_national" ON redfin_national FOR SELECT USING (true);
CREATE POLICY "Public read redfin_state" ON redfin_state FOR SELECT USING (true);
CREATE POLICY "Public read redfin_metro" ON redfin_metro FOR SELECT USING (true);
CREATE POLICY "Public read redfin_county" ON redfin_county FOR SELECT USING (true);
CREATE POLICY "Public read redfin_city" ON redfin_city FOR SELECT USING (true);
CREATE POLICY "Public read redfin_zip" ON redfin_zip FOR SELECT USING (true);
CREATE POLICY "Public read redfin_neighborhood" ON redfin_neighborhood FOR SELECT USING (true);

-- ============================================================================
-- 9. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON redfin_national TO authenticated;
GRANT SELECT ON redfin_national TO anon;
GRANT ALL ON redfin_national TO service_role;

GRANT SELECT ON redfin_state TO authenticated;
GRANT SELECT ON redfin_state TO anon;
GRANT ALL ON redfin_state TO service_role;

GRANT SELECT ON redfin_metro TO authenticated;
GRANT SELECT ON redfin_metro TO anon;
GRANT ALL ON redfin_metro TO service_role;

GRANT SELECT ON redfin_county TO authenticated;
GRANT SELECT ON redfin_county TO anon;
GRANT ALL ON redfin_county TO service_role;

GRANT SELECT ON redfin_city TO authenticated;
GRANT SELECT ON redfin_city TO anon;
GRANT ALL ON redfin_city TO service_role;

GRANT SELECT ON redfin_zip TO authenticated;
GRANT SELECT ON redfin_zip TO anon;
GRANT ALL ON redfin_zip TO service_role;

GRANT SELECT ON redfin_neighborhood TO authenticated;
GRANT SELECT ON redfin_neighborhood TO anon;
GRANT ALL ON redfin_neighborhood TO service_role;

-- ============================================================================
-- 10. ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE redfin_national IS 'National-level Redfin market tracker sales data (prices, inventory, DOM, sale-to-list). Source: https://www.redfin.com/news/data-center/';
COMMENT ON TABLE redfin_state IS 'State-level Redfin market tracker sales data (prices, inventory, DOM, sale-to-list). Source: https://www.redfin.com/news/data-center/';
COMMENT ON TABLE redfin_metro IS 'Metro-level Redfin market tracker sales data (prices, inventory, DOM, sale-to-list). Source: https://www.redfin.com/news/data-center/';
COMMENT ON TABLE redfin_county IS 'County-level Redfin market tracker sales data (prices, inventory, DOM, sale-to-list). Source: https://www.redfin.com/news/data-center/';
COMMENT ON TABLE redfin_city IS 'City-level Redfin market tracker sales data (prices, inventory, DOM, sale-to-list). Source: https://www.redfin.com/news/data-center/';
COMMENT ON TABLE redfin_zip IS 'ZIP code-level Redfin market tracker sales data (prices, inventory, DOM, sale-to-list). Source: https://www.redfin.com/news/data-center/';
COMMENT ON TABLE redfin_neighborhood IS 'Neighborhood-level Redfin market tracker sales data (prices, inventory, DOM, sale-to-list). Source: https://www.redfin.com/news/data-center/';

COMMIT;

DO $$
BEGIN
    RAISE NOTICE 'Migration 103 completed: Created redfin_* sales tables (national, state, metro, county, city, zip, neighborhood)';
END $$;
