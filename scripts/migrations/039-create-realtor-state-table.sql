-- Migration 039: Create realtor_state table for Realtor.com state-level housing data
-- Data source: https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_State.csv

BEGIN;

-- ============================================================================
-- 1. CREATE REALTOR STATE TABLE
-- ============================================================================

-- Drop if exists (for clean re-run)
DROP TABLE IF EXISTS realtor_state CASCADE;

CREATE TABLE realtor_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date DATE NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    state_id VARCHAR(2) NOT NULL,  -- 2-letter state code

    -- Core listing price metrics
    median_listing_price DECIMAL,
    median_listing_price_mm DECIMAL,
    median_listing_price_yy DECIMAL,

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

    -- Unique constraint on period + state
    CONSTRAINT realtor_state_unique UNIQUE (period_date, state_id)
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_realtor_state_period_date ON realtor_state(period_date DESC);
CREATE INDEX idx_realtor_state_state_id ON realtor_state(state_id);
CREATE INDEX idx_realtor_state_state_period ON realtor_state(state_id, period_date DESC);

-- ============================================================================
-- 3. ENABLE RLS AND ADD POLICY
-- ============================================================================

ALTER TABLE realtor_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read realtor_state" ON realtor_state FOR SELECT USING (true);

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON realtor_state TO authenticated;
GRANT SELECT ON realtor_state TO anon;
GRANT ALL ON realtor_state TO service_role;

-- ============================================================================
-- 5. ADD COMMENT
-- ============================================================================

COMMENT ON TABLE realtor_state IS 'State-level Realtor.com housing market data including listing prices, inventory, and market activity metrics.';

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 039 completed: Created realtor_state table';
END $$;
