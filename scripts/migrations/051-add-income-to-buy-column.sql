-- Migration 050: Add income_to_buy proxy metric to calculated_metrics table
-- This provides "Income Needed to Buy" for all geographies using Realtor price data

BEGIN;

-- ============================================================================
-- 1. ADD INCOME_TO_BUY COLUMN
-- ============================================================================

-- Income to Buy: Annual income needed to afford home purchase
-- Formula: (Monthly Mortgage + Taxes + Insurance) × 12 / 0.28
-- Uses 20% down, 30-yr fixed, 1.1% property tax, 0.35% insurance
ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS income_to_buy DECIMAL(12, 2);

-- ============================================================================
-- 2. ADD INDEX FOR NEW COLUMN
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_calc_income_to_buy ON calculated_metrics(income_to_buy);

-- ============================================================================
-- 3. ADD COMMENT FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN calculated_metrics.income_to_buy IS 'Annual income needed to buy: (PITI × 12) / 0.28. Assumes 20% down, 30-yr fixed at assumed rate, 1.1% tax, 0.35% insurance.';

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 050 completed: Added income_to_buy column to calculated_metrics';
END $$;
