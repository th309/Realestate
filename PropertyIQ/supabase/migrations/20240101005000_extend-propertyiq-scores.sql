-- Migration: Extend PropertyIQ Scores Table
-- Description: Add Market Health columns, rename components, add inheritance tracking
-- Date: 2026-01-20

-- ============================================================================
-- PART 1: Rename existing columns to match new naming convention
-- ============================================================================

-- HomeReady: value → market_timing, momentum → growth_potential
ALTER TABLE propertyiq_scores RENAME COLUMN homeready_value TO homeready_market_timing;
ALTER TABLE propertyiq_scores RENAME COLUMN homeready_momentum TO homeready_growth_potential;

-- InvestorEdge: cashflow → cash_flow, growth → appreciation, demand → rent_demand, entrypoint → entry_point
ALTER TABLE propertyiq_scores RENAME COLUMN investoredge_cashflow TO investoredge_cash_flow;
ALTER TABLE propertyiq_scores RENAME COLUMN investoredge_growth TO investoredge_appreciation;
ALTER TABLE propertyiq_scores RENAME COLUMN investoredge_demand TO investoredge_rent_demand;
ALTER TABLE propertyiq_scores RENAME COLUMN investoredge_entrypoint TO investoredge_entry_point;

-- ============================================================================
-- PART 2: Add Market Health Index columns
-- ============================================================================

-- Market Health Score (0-100)
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_score NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_demand_strength NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_supply_balance NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_price_stability NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_economic_foundation NUMERIC(5,2);
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_trend TEXT;
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS market_health_trend_change NUMERIC(5,2);

-- Add constraint for Market Health trend
ALTER TABLE propertyiq_scores ADD CONSTRAINT valid_market_health_trend
  CHECK (market_health_trend IS NULL OR market_health_trend IN ('improving', 'stable', 'declining'));

-- Add constraint for Market Health score range
ALTER TABLE propertyiq_scores ADD CONSTRAINT valid_market_health_score
  CHECK (market_health_score IS NULL OR (market_health_score >= 0 AND market_health_score <= 100));

-- ============================================================================
-- PART 3: Add data completeness and inheritance tracking
-- ============================================================================

-- Data completeness: percentage of metrics available (vs inherited or missing)
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS data_completeness NUMERIC(5,2);

-- Track which metrics were inherited and from where
ALTER TABLE propertyiq_scores ADD COLUMN IF NOT EXISTS inherited_metrics JSONB;

-- ============================================================================
-- PART 4: Add indexes for new columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_market_health
  ON propertyiq_scores(market_health_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_completeness
  ON propertyiq_scores(data_completeness DESC NULLS LAST);

-- ============================================================================
-- PART 5: Update score_details constraint to include market_health
-- ============================================================================

-- Drop and recreate the score_type constraint to include market_health
ALTER TABLE propertyiq_score_details DROP CONSTRAINT IF EXISTS valid_score_type;
ALTER TABLE propertyiq_score_details ADD CONSTRAINT valid_score_type
  CHECK (score_type IN ('homeready', 'investoredge', 'market_health'));

-- ============================================================================
-- PART 6: Update scores_history to include Market Health
-- ============================================================================

ALTER TABLE propertyiq_scores_history ADD COLUMN IF NOT EXISTS market_health_score NUMERIC(5,2);

-- ============================================================================
-- PART 7: Update rankings table to include Market Health
-- ============================================================================

ALTER TABLE propertyiq_rankings ADD COLUMN IF NOT EXISTS market_health_rank_national INTEGER;
ALTER TABLE propertyiq_rankings ADD COLUMN IF NOT EXISTS market_health_rank_state INTEGER;
ALTER TABLE propertyiq_rankings ADD COLUMN IF NOT EXISTS market_health_percentile_national NUMERIC(5,2);
ALTER TABLE propertyiq_rankings ADD COLUMN IF NOT EXISTS market_health_percentile_state NUMERIC(5,2);

-- ============================================================================
-- PART 8: Add comments
-- ============================================================================

COMMENT ON COLUMN propertyiq_scores.homeready_market_timing IS 'Market Timing component (25%): price cuts, DOM, supply, pending activity';
COMMENT ON COLUMN propertyiq_scores.homeready_growth_potential IS 'Growth Potential component (15%): 5Y CAGR, population growth, income growth';
COMMENT ON COLUMN propertyiq_scores.investoredge_cash_flow IS 'Cash Flow component (35%): cap rate, GRM, yield, rent-to-price';
COMMENT ON COLUMN propertyiq_scores.investoredge_appreciation IS 'Appreciation component (20%): 5Y CAGR, YoY growth, population growth';
COMMENT ON COLUMN propertyiq_scores.investoredge_rent_demand IS 'Rent Demand component (20%): rent growth, pending ratio, DOM, renter share';
COMMENT ON COLUMN propertyiq_scores.investoredge_entry_point IS 'Entry Point component (15%): overvalued %, price cuts, supply';
COMMENT ON COLUMN propertyiq_scores.market_health_score IS 'Market Health Index (0-100): Overall market condition score';
COMMENT ON COLUMN propertyiq_scores.market_health_demand_strength IS 'Demand Strength component (35%): pending ratio, DOM, hotness';
COMMENT ON COLUMN propertyiq_scores.market_health_supply_balance IS 'Supply Balance component (25%): months of supply, inventory YoY, new listings YoY';
COMMENT ON COLUMN propertyiq_scores.market_health_price_stability IS 'Price Stability component (25%): price cuts, sale-to-list, appreciation';
COMMENT ON COLUMN propertyiq_scores.market_health_economic_foundation IS 'Economic Foundation component (15%): unemployment, employment growth';
COMMENT ON COLUMN propertyiq_scores.data_completeness IS 'Percentage of metrics with direct data (vs inherited or missing)';
COMMENT ON COLUMN propertyiq_scores.inherited_metrics IS 'JSONB array of metrics that were inherited from parent geography';
