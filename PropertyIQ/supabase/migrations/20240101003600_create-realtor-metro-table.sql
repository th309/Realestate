-- Migration 040: Create realtor_metro table for Realtor.com metro-level housing data
-- Combines Core and Hotness metrics

BEGIN;

-- ============================================================================
-- 1. CREATE REALTOR METRO TABLE
-- ============================================================================

DROP TABLE IF EXISTS realtor_metro CASCADE;

CREATE TABLE realtor_metro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    cbsa_code VARCHAR(10) NOT NULL,
    cbsa_title VARCHAR(200),

    -- Household/Hotness Rank
    household_rank INTEGER,
    hotness_rank INTEGER,
    hotness_rank_mm DECIMAL,
    hotness_rank_yy DECIMAL,
    hotness_score DECIMAL,
    supply_score DECIMAL,
    demand_score DECIMAL,

    -- Core listing price metrics
    median_listing_price DECIMAL,
    median_listing_price_mm DECIMAL,
    median_listing_price_yy DECIMAL,
    median_listing_price_vs_us DECIMAL,

    -- Active listing metrics
    active_listing_count INTEGER,
    active_listing_count_mm DECIMAL,
    active_listing_count_yy DECIMAL,

    -- Days on market metrics
    median_days_on_market INTEGER,
    median_days_on_market_mm DECIMAL,
    median_days_on_market_yy DECIMAL,
    median_dom_vs_us DECIMAL,

    -- New listing metrics
    new_listing_count INTEGER,
    new_listing_count_mm DECIMAL,
    new_listing_count_yy DECIMAL,

    -- Price increased metrics
    price_increased_count INTEGER,
    price_increased_count_mm DECIMAL,
    price_increased_count_yy DECIMAL,
    price_increased_share DECIMAL,
    price_increased_share_mm DECIMAL,
    price_increased_share_yy DECIMAL,

    -- Price reduced metrics
    price_reduced_count INTEGER,
    price_reduced_count_mm DECIMAL,
    price_reduced_count_yy DECIMAL,
    price_reduced_share DECIMAL,
    price_reduced_share_mm DECIMAL,
    price_reduced_share_yy DECIMAL,

    -- Pending listing metrics
    pending_listing_count INTEGER,
    pending_listing_count_mm DECIMAL,
    pending_listing_count_yy DECIMAL,

    -- Price per square foot metrics
    median_listing_price_per_square_foot DECIMAL,
    median_listing_price_per_square_foot_mm DECIMAL,
    median_listing_price_per_square_foot_yy DECIMAL,

    -- Square footage metrics
    median_square_feet INTEGER,
    median_square_feet_mm DECIMAL,
    median_square_feet_yy DECIMAL,

    -- Average listing price metrics
    average_listing_price DECIMAL,
    average_listing_price_mm DECIMAL,
    average_listing_price_yy DECIMAL,

    -- Total listing metrics
    total_listing_count INTEGER,
    total_listing_count_mm DECIMAL,
    total_listing_count_yy DECIMAL,

    -- Pending ratio metrics
    pending_ratio DECIMAL,
    pending_ratio_mm DECIMAL,
    pending_ratio_yy DECIMAL,

    -- Page view metrics (from hotness)
    page_view_count_per_property_mm DECIMAL,
    page_view_count_per_property_yy DECIMAL,
    page_view_count_per_property_vs_us DECIMAL,

    -- Quality flag
    quality_flag INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    CONSTRAINT realtor_metro_unique UNIQUE (period_date, cbsa_code)
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_realtor_metro_period_date ON realtor_metro(period_date DESC);
CREATE INDEX idx_realtor_metro_cbsa_code ON realtor_metro(cbsa_code);
CREATE INDEX idx_realtor_metro_cbsa_period ON realtor_metro(cbsa_code, period_date DESC);

-- ============================================================================
-- 3. ENABLE RLS AND ADD POLICY
-- ============================================================================

ALTER TABLE realtor_metro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read realtor_metro" ON realtor_metro FOR SELECT USING (true);

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON realtor_metro TO authenticated;
GRANT SELECT ON realtor_metro TO anon;
GRANT ALL ON realtor_metro TO service_role;

COMMENT ON TABLE realtor_metro IS 'Metro-level Realtor.com housing market data combining core listing metrics and hotness indicators.';

COMMIT;

DO $$
BEGIN
    RAISE NOTICE 'Migration 040 completed: Created realtor_metro table';
END $$;
