-- Migration 042: Create realtor_zip table for Realtor.com ZIP-level housing data
-- Combines Core and Hotness metrics

BEGIN;

-- ============================================================================
-- 1. CREATE REALTOR ZIP TABLE
-- ============================================================================

DROP TABLE IF EXISTS realtor_zip CASCADE;

CREATE TABLE realtor_zip (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    zip_name VARCHAR(200),

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
    CONSTRAINT realtor_zip_unique UNIQUE (period_date, postal_code)
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_realtor_zip_period_date ON realtor_zip(period_date DESC);
CREATE INDEX idx_realtor_zip_postal_code ON realtor_zip(postal_code);
CREATE INDEX idx_realtor_zip_postal_period ON realtor_zip(postal_code, period_date DESC);

-- ============================================================================
-- 3. ENABLE RLS AND ADD POLICY
-- ============================================================================

ALTER TABLE realtor_zip ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read realtor_zip" ON realtor_zip FOR SELECT USING (true);

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON realtor_zip TO authenticated;
GRANT SELECT ON realtor_zip TO anon;
GRANT ALL ON realtor_zip TO service_role;

COMMENT ON TABLE realtor_zip IS 'ZIP-level Realtor.com housing market data combining core listing metrics and hotness indicators.';

COMMIT;

DO $$
BEGIN
    RAISE NOTICE 'Migration 042 completed: Created realtor_zip table';
END $$;
