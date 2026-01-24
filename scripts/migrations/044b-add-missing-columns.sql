-- Migration 044b: Add missing columns to propertyiq_scores and create history table
-- Run this after the base propertyiq_scores table exists

-- Add Market Health columns to propertyiq_scores if they don't exist
DO $$
BEGIN
  -- Market Health Score columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'propertyiq_scores' AND column_name = 'market_health_score') THEN
    ALTER TABLE propertyiq_scores ADD COLUMN market_health_score NUMERIC(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'propertyiq_scores' AND column_name = 'market_health_demand_strength') THEN
    ALTER TABLE propertyiq_scores ADD COLUMN market_health_demand_strength NUMERIC(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'propertyiq_scores' AND column_name = 'market_health_supply_balance') THEN
    ALTER TABLE propertyiq_scores ADD COLUMN market_health_supply_balance NUMERIC(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'propertyiq_scores' AND column_name = 'market_health_price_stability') THEN
    ALTER TABLE propertyiq_scores ADD COLUMN market_health_price_stability NUMERIC(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'propertyiq_scores' AND column_name = 'market_health_economic_foundation') THEN
    ALTER TABLE propertyiq_scores ADD COLUMN market_health_economic_foundation NUMERIC(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'propertyiq_scores' AND column_name = 'market_health_trend') THEN
    ALTER TABLE propertyiq_scores ADD COLUMN market_health_trend TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'propertyiq_scores' AND column_name = 'market_health_trend_change') THEN
    ALTER TABLE propertyiq_scores ADD COLUMN market_health_trend_change NUMERIC(5,2);
  END IF;

  -- Data version column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'propertyiq_scores' AND column_name = 'data_version') THEN
    ALTER TABLE propertyiq_scores ADD COLUMN data_version TEXT;
  END IF;
END $$;

-- Add constraints for Market Health
ALTER TABLE propertyiq_scores DROP CONSTRAINT IF EXISTS valid_market_health_score;
ALTER TABLE propertyiq_scores ADD CONSTRAINT valid_market_health_score
  CHECK (market_health_score IS NULL OR (market_health_score >= 0 AND market_health_score <= 100));

ALTER TABLE propertyiq_scores DROP CONSTRAINT IF EXISTS valid_market_health_trend;
ALTER TABLE propertyiq_scores ADD CONSTRAINT valid_market_health_trend
  CHECK (market_health_trend IS NULL OR market_health_trend IN ('improving', 'stable', 'declining'));

-- Create index for Market Health
CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_market_health ON propertyiq_scores(market_health_score DESC NULLS LAST);

-- Create History Table for backtesting
CREATE TABLE IF NOT EXISTS propertyiq_scores_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  period_date DATE NOT NULL,
  market_health_score NUMERIC(5,2),
  homeready_score NUMERIC(5,2),
  investoredge_score NUMERIC(5,2),

  -- Actual outcomes (filled in retrospectively for backtesting)
  actual_appreciation_12m NUMERIC(6,3),
  actual_appreciation_24m NUMERIC(6,3),
  actual_rent_growth_12m NUMERIC(6,3),
  actual_dom_avg_12m NUMERIC(6,2),

  -- Validation metrics
  prediction_error_12m NUMERIC(6,3),
  prediction_error_24m NUMERIC(6,3),

  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcomes_updated_at TIMESTAMPTZ,

  CONSTRAINT valid_history_geography_type CHECK (geography_type IN ('metro', 'county', 'zip', 'state', 'national')),
  CONSTRAINT unique_history_geography_period UNIQUE (geography_id, geography_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_propertyiq_history_geography ON propertyiq_scores_history(geography_id, geography_type, period_date DESC);
CREATE INDEX IF NOT EXISTS idx_propertyiq_history_period ON propertyiq_scores_history(period_date);

GRANT SELECT, INSERT, UPDATE ON propertyiq_scores_history TO authenticated;
GRANT SELECT ON propertyiq_scores_history TO anon;

COMMENT ON TABLE propertyiq_scores_history IS 'Historical PropertyIQ scores with actual outcomes for backtesting validation.';

-- Verify
SELECT 'propertyiq_scores columns:' as info, count(*) as col_count
FROM information_schema.columns
WHERE table_name = 'propertyiq_scores';

SELECT 'propertyiq_scores_history:' as info,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'propertyiq_scores_history')
  THEN 'EXISTS' ELSE 'MISSING' END as status;
