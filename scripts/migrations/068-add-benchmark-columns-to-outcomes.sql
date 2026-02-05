-- Migration 068: Add benchmark comparison columns to propertyiq_backtest_outcomes
-- Description: Adds state/national benchmark returns and excess return columns
--              for validating PropertyIQ score predictive power
-- Date: 2025-02-05

-- ============================================================================
-- Add state benchmark return columns
-- ============================================================================

ALTER TABLE propertyiq_backtest_outcomes
ADD COLUMN IF NOT EXISTS state_return_1y NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS state_return_3y_cagr NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS state_return_5y_cagr NUMERIC(8,4);

COMMENT ON COLUMN propertyiq_backtest_outcomes.state_return_1y IS 'State ZHVI 1-year return for benchmark comparison';
COMMENT ON COLUMN propertyiq_backtest_outcomes.state_return_3y_cagr IS 'State ZHVI 3-year CAGR for benchmark comparison';
COMMENT ON COLUMN propertyiq_backtest_outcomes.state_return_5y_cagr IS 'State ZHVI 5-year CAGR for benchmark comparison';

-- ============================================================================
-- Add national benchmark return columns
-- ============================================================================

ALTER TABLE propertyiq_backtest_outcomes
ADD COLUMN IF NOT EXISTS national_return_1y NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS national_return_3y_cagr NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS national_return_5y_cagr NUMERIC(8,4);

COMMENT ON COLUMN propertyiq_backtest_outcomes.national_return_1y IS 'National ZHVI 1-year return for benchmark comparison';
COMMENT ON COLUMN propertyiq_backtest_outcomes.national_return_3y_cagr IS 'National ZHVI 3-year CAGR for benchmark comparison';
COMMENT ON COLUMN propertyiq_backtest_outcomes.national_return_5y_cagr IS 'National ZHVI 5-year CAGR for benchmark comparison';

-- ============================================================================
-- Add excess return columns (location return - benchmark return)
-- ============================================================================

ALTER TABLE propertyiq_backtest_outcomes
ADD COLUMN IF NOT EXISTS excess_vs_state_1y NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS excess_vs_state_3y NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS excess_vs_state_5y NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS excess_vs_national_1y NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS excess_vs_national_3y NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS excess_vs_national_5y NUMERIC(8,4);

COMMENT ON COLUMN propertyiq_backtest_outcomes.excess_vs_state_1y IS 'Location 1Y return minus state 1Y return';
COMMENT ON COLUMN propertyiq_backtest_outcomes.excess_vs_state_3y IS 'Location 3Y CAGR minus state 3Y CAGR';
COMMENT ON COLUMN propertyiq_backtest_outcomes.excess_vs_state_5y IS 'Location 5Y CAGR minus state 5Y CAGR';
COMMENT ON COLUMN propertyiq_backtest_outcomes.excess_vs_national_1y IS 'Location 1Y return minus national 1Y return';
COMMENT ON COLUMN propertyiq_backtest_outcomes.excess_vs_national_3y IS 'Location 3Y CAGR minus national 3Y CAGR';
COMMENT ON COLUMN propertyiq_backtest_outcomes.excess_vs_national_5y IS 'Location 5Y CAGR minus national 5Y CAGR';

-- ============================================================================
-- Add rent growth tracking for InvestorEdge validation
-- ============================================================================

ALTER TABLE propertyiq_backtest_outcomes
ADD COLUMN IF NOT EXISTS rent_return_1y NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS rent_return_3y_cagr NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS state_rent_return_1y NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS state_rent_return_3y_cagr NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS national_rent_return_1y NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS national_rent_return_3y_cagr NUMERIC(8,4);

COMMENT ON COLUMN propertyiq_backtest_outcomes.rent_return_1y IS 'Location ZORI 1-year return';
COMMENT ON COLUMN propertyiq_backtest_outcomes.rent_return_3y_cagr IS 'Location ZORI 3-year CAGR';
COMMENT ON COLUMN propertyiq_backtest_outcomes.state_rent_return_1y IS 'State ZORI 1-year return';
COMMENT ON COLUMN propertyiq_backtest_outcomes.state_rent_return_3y_cagr IS 'State ZORI 3-year CAGR';
COMMENT ON COLUMN propertyiq_backtest_outcomes.national_rent_return_1y IS 'National ZORI 1-year return';
COMMENT ON COLUMN propertyiq_backtest_outcomes.national_rent_return_3y_cagr IS 'National ZORI 3-year CAGR';

-- ============================================================================
-- Add state_code for easier lookups
-- ============================================================================

ALTER TABLE propertyiq_backtest_outcomes
ADD COLUMN IF NOT EXISTS state_code VARCHAR(2);

COMMENT ON COLUMN propertyiq_backtest_outcomes.state_code IS 'State code for benchmark lookup';

-- ============================================================================
-- Create indexes for benchmark analysis queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_backtest_outcomes_excess_state
    ON propertyiq_backtest_outcomes(score_value, excess_vs_state_1y)
    WHERE score_value IS NOT NULL AND excess_vs_state_1y IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_backtest_outcomes_excess_national
    ON propertyiq_backtest_outcomes(score_value, excess_vs_national_1y)
    WHERE score_value IS NOT NULL AND excess_vs_national_1y IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_backtest_outcomes_score_date
    ON propertyiq_backtest_outcomes(score_date, geography_type);

CREATE INDEX IF NOT EXISTS idx_backtest_outcomes_state
    ON propertyiq_backtest_outcomes(state_code)
    WHERE state_code IS NOT NULL;

-- ============================================================================
-- Verify columns added
-- ============================================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'propertyiq_backtest_outcomes'
  AND column_name LIKE '%return%' OR column_name LIKE '%excess%'
ORDER BY ordinal_position;
