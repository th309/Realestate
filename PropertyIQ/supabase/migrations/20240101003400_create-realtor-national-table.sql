-- Migration 038: Create realtor_national table for Realtor.com national-level housing data
-- Data source: https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Country.csv

BEGIN;

-- ============================================================================
-- 1. CREATE REALTOR NATIONAL TABLE
-- ============================================================================

-- Drop if exists (for clean re-run)
DROP TABLE IF EXISTS realtor_national CASCADE;

CREATE TABLE realtor_national (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    country VARCHAR(50) NOT NULL DEFAULT 'United States',

    -- Core listing price metrics
    median_listing_price DECIMAL,
    median_listing_price_mm DECIMAL,  -- month-over-month change
    median_listing_price_yy DECIMAL,  -- year-over-year change

    -- Active listing metrics
    active_listing_count INTEGER,
    active_listing_count_mm DECIMAL,
    active_listing_count_yy DECIMAL,

    -- Days on market metrics
    median_days_on_market INTEGER,
    median_days_on_market_mm DECIMAL,
    median_days_on_market_yy DECIMAL,

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

    -- Quality flag
    quality_flag INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint on period
    CONSTRAINT realtor_national_period_unique UNIQUE (period_date)
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_realtor_national_period_date ON realtor_national(period_date DESC);

-- ============================================================================
-- 3. ENABLE RLS AND ADD POLICY
-- ============================================================================

ALTER TABLE realtor_national ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read realtor_national" ON realtor_national FOR SELECT USING (true);

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON realtor_national TO authenticated;
GRANT SELECT ON realtor_national TO anon;
GRANT ALL ON realtor_national TO service_role;

-- ============================================================================
-- 5. ADD COMMENT
-- ============================================================================

COMMENT ON TABLE realtor_national IS 'National-level Realtor.com housing market data including listing prices, inventory, and market activity metrics.';

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 038 completed: Created realtor_national table';
END $$;
