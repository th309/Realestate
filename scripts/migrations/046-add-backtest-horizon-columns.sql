-- Migration 046: Add longer-horizon backtest columns to propertyiq_scores_history
-- Description: Adds 36m, 60m, and 120m actual outcome columns for comprehensive backtesting
-- Date: 2025-01-22

-- Add additional appreciation columns for longer horizons
ALTER TABLE propertyiq_scores_history
ADD COLUMN IF NOT EXISTS actual_appreciation_36m NUMERIC(6,3),  -- 3-year actual appreciation
ADD COLUMN IF NOT EXISTS actual_appreciation_60m NUMERIC(6,3),  -- 5-year actual appreciation
ADD COLUMN IF NOT EXISTS actual_appreciation_120m NUMERIC(6,3); -- 10-year actual appreciation

-- Add corresponding rent growth columns
ALTER TABLE propertyiq_scores_history
ADD COLUMN IF NOT EXISTS actual_rent_growth_24m NUMERIC(6,3),   -- 2-year actual rent growth
ADD COLUMN IF NOT EXISTS actual_rent_growth_36m NUMERIC(6,3),   -- 3-year actual rent growth
ADD COLUMN IF NOT EXISTS actual_rent_growth_60m NUMERIC(6,3);   -- 5-year actual rent growth

-- Add prediction error columns for longer horizons
ALTER TABLE propertyiq_scores_history
ADD COLUMN IF NOT EXISTS prediction_error_36m NUMERIC(6,3),
ADD COLUMN IF NOT EXISTS prediction_error_60m NUMERIC(6,3);

-- Add indexes for efficient backtesting queries
CREATE INDEX IF NOT EXISTS idx_history_investoredge_outcomes
  ON propertyiq_scores_history(investoredge_score, actual_appreciation_12m)
  WHERE investoredge_score IS NOT NULL AND actual_appreciation_12m IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_history_homeready_outcomes
  ON propertyiq_scores_history(homeready_score, actual_appreciation_12m)
  WHERE homeready_score IS NOT NULL AND actual_appreciation_12m IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_history_market_health_outcomes
  ON propertyiq_scores_history(market_health_score, actual_appreciation_12m)
  WHERE market_health_score IS NOT NULL AND actual_appreciation_12m IS NOT NULL;

-- Add index for period-based queries
CREATE INDEX IF NOT EXISTS idx_history_period_type
  ON propertyiq_scores_history(period_date, geography_type);

-- Comment updates
COMMENT ON COLUMN propertyiq_scores_history.actual_appreciation_36m IS 'Actual ZHVI appreciation 36 months after score date';
COMMENT ON COLUMN propertyiq_scores_history.actual_appreciation_60m IS 'Actual ZHVI appreciation 60 months after score date';
COMMENT ON COLUMN propertyiq_scores_history.actual_appreciation_120m IS 'Actual ZHVI appreciation 120 months after score date';
COMMENT ON COLUMN propertyiq_scores_history.actual_rent_growth_36m IS 'Actual ZORI growth 36 months after score date';
COMMENT ON COLUMN propertyiq_scores_history.actual_rent_growth_60m IS 'Actual ZORI growth 60 months after score date';

-- Verify columns added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'propertyiq_scores_history'
  AND column_name LIKE 'actual_%'
ORDER BY ordinal_position;
