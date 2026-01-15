-- Migration: Create PropertyIQ Scores Table
-- Description: Stores calculated HomeReady and InvestorEdge scores for all geographies
-- Date: 2025-01-14

-- Main Scores Table
CREATE TABLE IF NOT EXISTS propertyiq_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Geography identification
  geography_id TEXT NOT NULL,           -- CBSA code, FIPS, or ZIP
  geography_type TEXT NOT NULL,         -- 'metro', 'county', 'zip'
  geography_name TEXT NOT NULL,         -- Human-readable name
  state_code TEXT,                      -- Two-letter state code
  parent_geography_id TEXT,             -- Parent metro/county for ZIPs

  -- Period
  period_date DATE NOT NULL,            -- First of month (e.g., 2025-01-01)

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

  -- Confidence
  confidence_level TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
  metrics_available INTEGER,                       -- Count of metrics with data
  metrics_total INTEGER,                           -- Total metrics needed
  data_freshness_days INTEGER,                     -- Days since most recent data

  -- Metadata
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_version TEXT,                               -- Version of scoring algorithm

  -- Constraints
  CONSTRAINT valid_homeready_score CHECK (homeready_score IS NULL OR (homeready_score >= 0 AND homeready_score <= 100)),
  CONSTRAINT valid_investoredge_score CHECK (investoredge_score IS NULL OR (investoredge_score >= 0 AND investoredge_score <= 100)),
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
CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_homeready ON propertyiq_scores(homeready_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_investoredge ON propertyiq_scores(investoredge_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_propertyiq_scores_type_period ON propertyiq_scores(geography_type, period_date DESC);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON propertyiq_scores TO authenticated;
GRANT SELECT ON propertyiq_scores TO anon;

-- Add comment
COMMENT ON TABLE propertyiq_scores IS 'PropertyIQ proprietary scores: HomeReady (homebuyers/renters) and InvestorEdge (investors). Calculated monthly for metros, counties, and ZIP codes.';

-- Score History Table (for trend analysis)
CREATE TABLE IF NOT EXISTS propertyiq_scores_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  period_date DATE NOT NULL,
  homeready_score NUMERIC(5,2),
  investoredge_score NUMERIC(5,2),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_history_geography_type CHECK (geography_type IN ('metro', 'county', 'zip', 'state', 'national'))
);

CREATE INDEX IF NOT EXISTS idx_propertyiq_history_geography ON propertyiq_scores_history(geography_id, geography_type, period_date DESC);

GRANT SELECT, INSERT ON propertyiq_scores_history TO authenticated;
GRANT SELECT ON propertyiq_scores_history TO anon;

COMMENT ON TABLE propertyiq_scores_history IS 'Historical PropertyIQ scores for trend analysis. Archived when new scores are calculated.';

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
