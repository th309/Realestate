-- Migration 049: Add market supply metrics to calculated_metrics table
-- These support the Data Card Mapping implementation plan

BEGIN;

-- ============================================================================
-- 1. ADD NEW MARKET SUPPLY METRIC COLUMNS
-- ============================================================================

-- Months of Supply: inventory / monthly_sales
-- Balanced market: 4-6 months, Seller's market: < 4, Buyer's market: > 6
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS months_of_supply DECIMAL(6, 2);

-- Absorption Rate: (monthly_sales / inventory) x 100
-- Percentage of available inventory sold per month
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS absorption_rate DECIMAL(8, 4);

-- ============================================================================
-- 2. ADD INDEXES FOR NEW COLUMNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_calc_months_supply ON calculated_metrics(months_of_supply);
CREATE INDEX IF NOT EXISTS idx_calc_absorption ON calculated_metrics(absorption_rate);

-- ============================================================================
-- 3. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN calculated_metrics.months_of_supply IS 'Months of supply = inventory / monthly_sales. Balanced: 4-6 months';
COMMENT ON COLUMN calculated_metrics.absorption_rate IS 'Absorption rate = (monthly_sales / inventory) x 100. Higher = stronger demand';

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 049 completed: Added months_of_supply and absorption_rate columns to calculated_metrics';
END $$;
