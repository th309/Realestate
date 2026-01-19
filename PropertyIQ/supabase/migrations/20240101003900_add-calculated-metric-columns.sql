-- Migration 043: Add additional calculated metric columns to calculated_metrics table
-- These support the Data Card Mapping implementation plan

BEGIN;

-- ============================================================================
-- 1. ADD NEW CALCULATED METRIC COLUMNS
-- ============================================================================

-- Cap Rate: (ZORI x 12 x 0.6) / median_listing_price x 100
-- Using expense ratio of 0.6 (60% NOI)
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS cap_rate DECIMAL(10, 4);

-- Gross Yield: (ZORI x 12) / median_listing_price x 100
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS gross_yield DECIMAL(10, 4);

-- Rent-to-Price Ratio: ZORI / median_listing_price
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS rent_to_price_ratio DECIMAL(10, 6);

-- Market Health Score: Composite of DOM, inventory, price cuts, pending ratio (0-100)
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS market_health_score DECIMAL(5, 2);

-- Investment Score: Composite of cap rate, rent growth, appreciation (0-100)
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS investment_score DECIMAL(5, 2);

-- Long-Term Growth Score: Composite of 5yr CAGR, demand, price trends (0-100)
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS long_term_growth_score DECIMAL(5, 2);

-- Home Value 5-Year CAGR: (current / 5yr_ago)^(1/5) - 1
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS home_value_5yr_cagr DECIMAL(8, 4);

-- Inventory Surplus %: (current - 5yr_avg) / 5yr_avg x 100
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS inventory_surplus_pct DECIMAL(8, 4);

-- Overvalued %: (price_to_income - 3.5) / 3.5 x 100
-- Based on traditional 3.5x income-to-price ratio benchmark
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS overvalued_pct DECIMAL(8, 4);

-- ============================================================================
-- 2. ADD INDEXES FOR NEW COLUMNS (for filtering/sorting)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_calc_cap_rate ON calculated_metrics(cap_rate);
CREATE INDEX IF NOT EXISTS idx_calc_market_health ON calculated_metrics(market_health_score);
CREATE INDEX IF NOT EXISTS idx_calc_investment ON calculated_metrics(investment_score);
CREATE INDEX IF NOT EXISTS idx_calc_growth ON calculated_metrics(long_term_growth_score);

-- ============================================================================
-- 3. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN calculated_metrics.cap_rate IS 'Cap rate calculated as (ZORI x 12 x 0.6) / median_listing_price x 100';
COMMENT ON COLUMN calculated_metrics.gross_yield IS 'Gross yield calculated as (ZORI x 12) / median_listing_price x 100';
COMMENT ON COLUMN calculated_metrics.rent_to_price_ratio IS 'Monthly rent to price ratio: ZORI / median_listing_price';
COMMENT ON COLUMN calculated_metrics.market_health_score IS 'Composite score (0-100) based on DOM, inventory, price cuts, pending ratio';
COMMENT ON COLUMN calculated_metrics.investment_score IS 'Composite score (0-100) based on cap rate, rent growth, appreciation';
COMMENT ON COLUMN calculated_metrics.long_term_growth_score IS 'Composite score (0-100) based on 5yr CAGR, demand score, price trends';
COMMENT ON COLUMN calculated_metrics.home_value_5yr_cagr IS '5-year compound annual growth rate of home values';
COMMENT ON COLUMN calculated_metrics.inventory_surplus_pct IS 'Current inventory vs 5-year average as percentage';
COMMENT ON COLUMN calculated_metrics.overvalued_pct IS 'Overvaluation percentage based on price-to-income ratio vs 3.5x benchmark';

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 043 completed: Added calculated metric columns (cap_rate, gross_yield, market_health_score, etc.)';
END $$;
