-- Migration: Create PropertyIQ Scores Table
-- Description: Stores all 3 PropertyIQ scores (Market Health, HomeReady, InvestorEdge) for all geographies
-- Date: 2025-01-14
-- Updated: 2025-01-22 - Added Market Health score

-- Main Scores Table
CREATE TABLE IF NOT EXISTS propertyiq_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Geography identification
  geography_id TEXT NOT NULL,           -- CBSA code, FIPS, or ZIP
  geography_type TEXT NOT NULL,         -- 'metro', 'county', 'zip', 'state'
  geography_name TEXT NOT NULL,         -- Human-readable name
  state_code TEXT,                      -- Two-letter state code
  parent_geography_id TEXT,             -- Parent metro/county for ZIPs

  -- Period
  period_date DATE NOT NULL,            -- First of month (e.g., 2025-01-01)

  -- Market Health Score (Free tier - General market conditions)
  market_health_score NUMERIC(5,2),               -- 0-100 overall
  market_health_demand_strength NUMERIC(5,2),     -- 0-100 component
  market_health_supply_balance NUMERIC(5,2),      -- 0-100 component
  market_health_price_stability NUMERIC(5,2),     -- 0-100 component
  market_health_economic_foundation NUMERIC(5,2), -- 0-100 component
  market_health_trend TEXT,                       -- 'improving', 'stable', 'declining'
  market_health_trend_change NUMERIC(5,2),        -- Point change over 6 months

  -- HomeReady Score (Homebuyers/Renters)
  homeready_score NUMERIC(5,2),                    -- 0-100 overall
  homeready_affordability NUMERIC(5,2),            -- 0-100 component
  homeready_stability NUMERIC(5,2),                -- 0-100 component
  homeready_value NUMERIC(5,2),                    -- 0-100 component
  homeready_livability NUMERIC(5,2),               -- 0-100 component
  homeready_momentum NUMERIC(5,2),                 -- 0-100 component
  homeready_trend TEXT,                            -- 'improving', 'stable', 'declining'
  homeready_trend_change NUMERIC(5,2),             -- Point change over 6 months

  -- InvestorEdge Score (Investors)
  investoredge_score NUMERIC(5,2),                 -- 0-100 overall
  investoredge_cashflow NUMERIC(5,2),              -- 0-100 component
  investoredge_growth NUMERIC(5,2),                -- 0-100 component
  investoredge_demand NUMERIC(5,2),                -- 0-100 component
  investoredge_entrypoint NUMERIC(5,2),            -- 0-100 component
  investoredge_risk NUMERIC(5,2),                  -- 0-100 component
  investoredge_trend TEXT,                         -- 'improving', 'stable', 'declining'
  investoredge_trend_change NUMERIC(5,2),          -- Point change over 6 months

  -- Confidence (applies to all scores)
  confidence_level TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
  metrics_available INTEGER,                       -- Count of metrics with data
  metrics_total INTEGER,                           -- Total metrics needed
  data_freshness_days INTEGER,                     -- Days since most recent data

  -- Metadata
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_version TEXT,                               -- Version of scoring algorithm

  -- Constraints
  CONSTRAINT valid_market_health_score CHECK (market_health_score IS NULL OR (market_health_score >= 0 AND market_health_score <= 100)),
  CONSTRAINT valid_homeready_score CHECK (homeready_score IS NULL OR (homeready_score >= 0 AND homeready_score <= 100)),
  CONSTRAINT valid_investoredge_score CHECK (investoredge_score IS NULL OR (investoredge_score >= 0 AND investoredge_score <= 100)),
  CONSTRAINT valid_market_health_trend CHECK (market_health_trend IS NULL OR market_health_trend IN ('improving', 'stable', 'declining')),
  CONSTRAINT valid_homeready_trend CHECK (homeready_trend IS NULL OR homeready_trend IN ('improving', 'stable', 'declining')),
  CONSTRAINT valid_investoredge_trend CHECK (investoredge_trend IS NULL OR investoredge_trend IN ('improving', 'stable', 'declining')),
  CONSTRAINT valid_confidence_level CHECK (confidence_level IN ('high', 'medium', 'low')),
  CONSTRAINT valid_geography_type CHECK (geography_type IN ('metro', 'county', 'zip', 'state', 'national')),

  -- Unique constraint: one score per geography per period
  CONSTRAINT unique_geography_period UNIQUE (geography_id, geography_type, period_date)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_geography ON propertyiq_scores(geography_id, geography_type);
CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_period ON propertyiq_scores(period_date DESC);
CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_state ON propertyiq_scores(state_code);
CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_market_health ON propertyiq_scores(market_health_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_homeready ON propertyiq_scores(homeready_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_investoredge ON propertyiq_scores(investoredge_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_type_period ON propertyiq_scores(geography_type, period_date DESC);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON propertyiq_scores TO authenticated;
GRANT SELECT ON propertyiq_scores TO anon;

-- Add comment
COMMENT ON TABLE propertyiq_scores IS 'All 3 PropertyIQ scores: Market Health (free), HomeReady (homebuyers), and InvestorEdge (investors). Calculated monthly for states, metros, counties, and ZIP codes.';

-- Score Details Table (for Pro tier component breakdown)
CREATE TABLE IF NOT EXISTS propertyiq_score_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  score_id UUID REFERENCES propertyiq_scores(id) ON DELETE CASCADE,

  -- Component identification
  score_type TEXT NOT NULL,              -- 'homeready' or 'investoredge'
  component TEXT NOT NULL,               -- 'affordability', 'cashflow', etc.

  -- Metrics that drove this component
  metrics JSONB NOT NULL,                -- Array of {metric_id, value, percentile, weight, contribution}

  -- Helping/Hurting factors
  helping_factors TEXT[],                -- Array of positive factors
  hurting_factors TEXT[],                -- Array of negative factors

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_score_type CHECK (score_type IN ('market_health', 'homeready', 'investoredge'))
);

CREATE INDEX IF NOT EXISTS idx_score_details_score ON propertyiq_score_details(score_id);
CREATE INDEX IF NOT EXISTS idx_score_details_component ON propertyiq_score_details(score_type, component);

GRANT SELECT, INSERT, DELETE ON propertyiq_score_details TO authenticated;
GRANT SELECT ON propertyiq_score_details TO anon;

COMMENT ON TABLE propertyiq_score_details IS 'Detailed component breakdown for PropertyIQ scores. Shows which metrics drove each component score.';

-- Score History Table (for backtesting and trend analysis)
CREATE TABLE IF NOT EXISTS propertyiq_scores_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  period_date DATE NOT NULL,
  market_health_score NUMERIC(5,2),
  homeready_score NUMERIC(5,2),
  investoredge_score NUMERIC(5,2),

  -- Actual outcomes (filled in retrospectively for backtesting)
  actual_appreciation_12m NUMERIC(6,3),    -- Actual price change 12 months later
  actual_appreciation_24m NUMERIC(6,3),    -- Actual price change 24 months later
  actual_rent_growth_12m NUMERIC(6,3),     -- Actual rent change 12 months later
  actual_dom_avg_12m NUMERIC(6,2),         -- Average DOM over next 12 months

  -- Validation metrics
  prediction_error_12m NUMERIC(6,3),       -- Score prediction vs actual
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

-- Rankings Table (for percentile comparisons)
CREATE TABLE IF NOT EXISTS propertyiq_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  period_date DATE NOT NULL,

  -- HomeReady rankings
  homeready_rank_national INTEGER,         -- Rank among all geographies of same type
  homeready_rank_state INTEGER,            -- Rank within state
  homeready_percentile_national NUMERIC(5,2), -- Percentile (0-100)
  homeready_percentile_state NUMERIC(5,2),    -- Percentile within state

  -- InvestorEdge rankings
  investoredge_rank_national INTEGER,
  investoredge_rank_state INTEGER,
  investoredge_percentile_national NUMERIC(5,2),
  investoredge_percentile_state NUMERIC(5,2),

  -- Metadata
  total_count_national INTEGER,
  total_count_state INTEGER,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_ranking_geography_period UNIQUE (geography_id, geography_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_propertyiq_rankings_geography ON propertyiq_rankings(geography_id, geography_type);
CREATE INDEX IF NOT EXISTS idx_propertyiq_rankings_period ON propertyiq_rankings(period_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON propertyiq_rankings TO authenticated;
GRANT SELECT ON propertyiq_rankings TO anon;

COMMENT ON TABLE propertyiq_rankings IS 'National and state rankings for PropertyIQ scores. Used for percentile displays and comparisons.';

-- Metric Percentiles Table (pre-computed for faster scoring)
-- NOTE: This table may already exist from migration 030. Using metric_name to match existing schema.
CREATE TABLE IF NOT EXISTS metric_percentiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  metric_name TEXT NOT NULL,             -- e.g., 'zhvi', 'zori', 'median_days_on_market'
  geography_type TEXT NOT NULL,          -- 'state', 'metro', 'county', 'zip'
  period_date DATE NOT NULL,

  -- Percentile breakpoints
  p10 NUMERIC,
  p20 NUMERIC,
  p30 NUMERIC,
  p40 NUMERIC,
  p50 NUMERIC,
  p60 NUMERIC,
  p70 NUMERIC,
  p80 NUMERIC,
  p90 NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  count_values INTEGER,
  mean_value NUMERIC,
  stddev_value NUMERIC,

  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_percentile_metric_geo_period UNIQUE (metric_name, geography_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_percentiles_lookup ON metric_percentiles(metric_name, geography_type, period_date DESC);
CREATE INDEX IF NOT EXISTS idx_percentiles_period ON metric_percentiles(period_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON metric_percentiles TO authenticated;
GRANT SELECT ON metric_percentiles TO anon;

COMMENT ON TABLE metric_percentiles IS 'Pre-computed percentile breakpoints for all scoring metrics. Used to quickly determine percentile rank during score calculation.';

-- Calculated Metrics Table (derived values for scoring)
CREATE TABLE IF NOT EXISTS calculated_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  period_date DATE NOT NULL,

  -- Derived from ZHVI/ZORI
  grm NUMERIC(8,2),                          -- Gross Rent Multiplier: ZHVI / (ZORI * 12)
  annual_rent_price_ratio NUMERIC(8,5),      -- (ZORI * 12) / ZHVI
  cap_rate_proxy NUMERIC(6,4),               -- Estimated cap rate
  price_rent_ratio NUMERIC(8,2),             -- ZHVI / ZORI (monthly)

  -- Year-over-year changes
  zhvi_yoy_change NUMERIC(8,4),              -- YoY price change %
  zori_yoy_change NUMERIC(8,4),              -- YoY rent change %
  inventory_yoy_change NUMERIC(8,4),         -- YoY inventory change %

  -- Multi-year changes
  zhvi_3y_change NUMERIC(8,4),               -- 3-year price change %
  zhvi_5y_change NUMERIC(8,4),               -- 5-year price change %
  zhvi_3y_cagr NUMERIC(8,4),                 -- 3-year compound annual growth rate
  zhvi_5y_cagr NUMERIC(8,4),                 -- 5-year compound annual growth rate

  -- 90-day momentum
  zhvi_90d_change NUMERIC(8,4),
  zori_90d_change NUMERIC(8,4),
  inventory_90d_change NUMERIC(8,4),
  dom_90d_change NUMERIC(8,4),

  -- Volatility metrics (standard deviation)
  zhvi_stddev_12m NUMERIC(12,2),             -- 1-year price std dev
  zhvi_stddev_36m NUMERIC(12,2),             -- 3-year price std dev
  zori_stddev_12m NUMERIC(10,2),             -- 1-year rent std dev
  inventory_stddev_12m NUMERIC(12,2),        -- 1-year inventory std dev
  dom_stddev_12m NUMERIC(8,2),               -- 1-year DOM std dev

  -- Affordability derived
  income_gap_ratio NUMERIC(8,4),             -- Income needed / Median income
  price_trend_deviation NUMERIC(8,4),        -- Current price vs 5-year trend line

  -- Risk metrics
  inventory_pct_vs_history NUMERIC(6,2),     -- Current inventory percentile vs 5yr range
  affordability_percentile NUMERIC(6,2),     -- Affordability vs all markets
  months_of_supply NUMERIC(6,2),             -- Inventory / pending sales

  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_calc_metrics_geo_period UNIQUE (geography_id, geography_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_calc_metrics_lookup ON calculated_metrics(geography_id, geography_type, period_date DESC);
CREATE INDEX IF NOT EXISTS idx_calc_metrics_period ON calculated_metrics(period_date DESC);
CREATE INDEX IF NOT EXISTS idx_calc_metrics_type_period ON calculated_metrics(geography_type, period_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON calculated_metrics TO authenticated;
GRANT SELECT ON calculated_metrics TO anon;

COMMENT ON TABLE calculated_metrics IS 'Derived metrics calculated from raw data sources. Used as inputs to PropertyIQ score calculation.';

-- Score Calculation Log (for debugging and audit)
CREATE TABLE IF NOT EXISTS score_calculation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  calculation_type TEXT NOT NULL,           -- 'full', 'incremental', 'single', 'backtest'
  geography_type TEXT,                      -- NULL for full calculation
  period_date DATE NOT NULL,

  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',   -- 'running', 'completed', 'failed'

  geographies_processed INTEGER DEFAULT 0,
  geographies_failed INTEGER DEFAULT 0,
  error_message TEXT,

  calculation_version TEXT,
  metadata JSONB                            -- Additional details

);

CREATE INDEX IF NOT EXISTS idx_calc_log_period ON score_calculation_log(period_date DESC);
CREATE INDEX IF NOT EXISTS idx_calc_log_status ON score_calculation_log(status);

GRANT SELECT, INSERT, UPDATE ON score_calculation_log TO authenticated;
GRANT SELECT ON score_calculation_log TO anon;

COMMENT ON TABLE score_calculation_log IS 'Audit log of score calculation runs for debugging and monitoring.';
