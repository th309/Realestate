-- Migration 047: Add benchmark tables for PropertyIQ backtesting
-- Supports three benchmark levels: National, Regional, and Peer Group

-- ============================================================================
-- PEER GROUP LOOKUP TABLE
-- 720 possible groups based on 5 dimensions
-- ============================================================================
CREATE TABLE IF NOT EXISTS backtest_peer_groups (
  peer_group_id VARCHAR(20) PRIMARY KEY,
  price_tier INTEGER NOT NULL,           -- 1-5: <$150K, $150-300K, $300-500K, $500K-1M, >$1M
  density_tier VARCHAR(1) NOT NULL,      -- R=Rural, S=Suburban, U=Urban
  region VARCHAR(2) NOT NULL,            -- NE=Northeast, MW=Midwest, SO=South, WE=West
  metro_size VARCHAR(1) NOT NULL,        -- S=Small, M=Medium, L=Large, X=Major
  growth_trend VARCHAR(1) NOT NULL,      -- D=Declining, S=Stable, G=Growing
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE backtest_peer_groups IS 'Peer group definitions for benchmark-adjusted backtesting';
COMMENT ON COLUMN backtest_peer_groups.price_tier IS '1=<$150K, 2=$150-300K, 3=$300-500K, 4=$500K-1M, 5=>$1M';
COMMENT ON COLUMN backtest_peer_groups.density_tier IS 'R=Rural (<500/sq mi), S=Suburban (500-3000), U=Urban (>3000)';
COMMENT ON COLUMN backtest_peer_groups.region IS 'NE=Northeast, MW=Midwest, SO=South, WE=West';
COMMENT ON COLUMN backtest_peer_groups.metro_size IS 'S=Small (<250K), M=Medium (250K-1M), L=Large (1-5M), X=Major (>5M)';
COMMENT ON COLUMN backtest_peer_groups.growth_trend IS 'D=Declining (<-2%), S=Stable (-2% to +5%), G=Growing (>5%)';

-- ============================================================================
-- NATIONAL BENCHMARKS
-- One row per period/horizon/geography_type combination
-- ============================================================================
CREATE TABLE IF NOT EXISTS backtest_benchmarks (
  score_date DATE NOT NULL,
  horizon VARCHAR(5) NOT NULL,           -- '12m', '24m', '36m', '60m', '120m'
  geography_type VARCHAR(10) NOT NULL,   -- 'state', 'metro', 'county', 'zip'
  national_avg_appreciation NUMERIC(8,5),
  national_median_appreciation NUMERIC(8,5),
  national_p25_appreciation NUMERIC(8,5),
  national_p75_appreciation NUMERIC(8,5),
  sample_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (score_date, horizon, geography_type)
);

COMMENT ON TABLE backtest_benchmarks IS 'National-level benchmarks for each score date and horizon';

-- ============================================================================
-- REGIONAL BENCHMARKS
-- Per parent geography (ZIPs use metro, counties use state)
-- ============================================================================
CREATE TABLE IF NOT EXISTS backtest_regional_benchmarks (
  score_date DATE NOT NULL,
  horizon VARCHAR(5) NOT NULL,
  parent_geography_id VARCHAR(20) NOT NULL,  -- CBSA code for metros, state code for states
  parent_geography_type VARCHAR(10) NOT NULL, -- 'metro' or 'state'
  avg_appreciation NUMERIC(8,5),
  median_appreciation NUMERIC(8,5),
  p25_appreciation NUMERIC(8,5),
  p75_appreciation NUMERIC(8,5),
  child_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (score_date, horizon, parent_geography_id)
);

COMMENT ON TABLE backtest_regional_benchmarks IS 'Regional benchmarks aggregated by parent geography';

-- ============================================================================
-- PEER GROUP BENCHMARKS
-- Per peer group for fair comparison among similar geographies
-- ============================================================================
CREATE TABLE IF NOT EXISTS backtest_peer_benchmarks (
  score_date DATE NOT NULL,
  horizon VARCHAR(5) NOT NULL,
  peer_group_id VARCHAR(20) NOT NULL,
  median_appreciation NUMERIC(8,5),
  avg_appreciation NUMERIC(8,5),
  p25_appreciation NUMERIC(8,5),
  p75_appreciation NUMERIC(8,5),
  peer_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (score_date, horizon, peer_group_id)
);

COMMENT ON TABLE backtest_peer_benchmarks IS 'Peer group benchmarks for apples-to-apples comparison';

-- ============================================================================
-- ADD COLUMNS TO HISTORY TABLE
-- Peer group assignment and excess return calculations
-- ============================================================================

-- Peer group assignment columns
ALTER TABLE propertyiq_scores_history
ADD COLUMN IF NOT EXISTS peer_group_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS parent_geography_id VARCHAR(20);

-- Excess return columns for 12-month horizon
ALTER TABLE propertyiq_scores_history
ADD COLUMN IF NOT EXISTS excess_return_vs_national_12m NUMERIC(8,5),
ADD COLUMN IF NOT EXISTS excess_return_vs_regional_12m NUMERIC(8,5),
ADD COLUMN IF NOT EXISTS excess_return_vs_peer_12m NUMERIC(8,5);

-- Excess return columns for 24-month horizon
ALTER TABLE propertyiq_scores_history
ADD COLUMN IF NOT EXISTS excess_return_vs_national_24m NUMERIC(8,5),
ADD COLUMN IF NOT EXISTS excess_return_vs_regional_24m NUMERIC(8,5),
ADD COLUMN IF NOT EXISTS excess_return_vs_peer_24m NUMERIC(8,5);

-- Excess return columns for 36-month horizon
ALTER TABLE propertyiq_scores_history
ADD COLUMN IF NOT EXISTS excess_return_vs_national_36m NUMERIC(8,5),
ADD COLUMN IF NOT EXISTS excess_return_vs_regional_36m NUMERIC(8,5),
ADD COLUMN IF NOT EXISTS excess_return_vs_peer_36m NUMERIC(8,5);

-- Excess return columns for 60-month horizon
ALTER TABLE propertyiq_scores_history
ADD COLUMN IF NOT EXISTS excess_return_vs_national_60m NUMERIC(8,5),
ADD COLUMN IF NOT EXISTS excess_return_vs_regional_60m NUMERIC(8,5),
ADD COLUMN IF NOT EXISTS excess_return_vs_peer_60m NUMERIC(8,5);

-- Weighted excess return (combined across all benchmarks)
ALTER TABLE propertyiq_scores_history
ADD COLUMN IF NOT EXISTS weighted_excess_return_12m NUMERIC(8,5),
ADD COLUMN IF NOT EXISTS weighted_excess_return_36m NUMERIC(8,5),
ADD COLUMN IF NOT EXISTS weighted_excess_return_60m NUMERIC(8,5);

-- ============================================================================
-- INDEXES FOR BENCHMARK QUERIES
-- ============================================================================

-- Index for peer group lookups
CREATE INDEX IF NOT EXISTS idx_history_peer_group
  ON propertyiq_scores_history(peer_group_id)
  WHERE peer_group_id IS NOT NULL;

-- Index for regional benchmark lookups
CREATE INDEX IF NOT EXISTS idx_history_parent_geography
  ON propertyiq_scores_history(parent_geography_id)
  WHERE parent_geography_id IS NOT NULL;

-- Index for excess return analysis by score type
CREATE INDEX IF NOT EXISTS idx_history_investoredge_excess_12m
  ON propertyiq_scores_history(investoredge_score, weighted_excess_return_12m)
  WHERE investoredge_score IS NOT NULL AND weighted_excess_return_12m IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_history_homeready_excess_12m
  ON propertyiq_scores_history(homeready_score, weighted_excess_return_12m)
  WHERE homeready_score IS NOT NULL AND weighted_excess_return_12m IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_history_market_health_excess_12m
  ON propertyiq_scores_history(market_health_score, weighted_excess_return_12m)
  WHERE market_health_score IS NOT NULL AND weighted_excess_return_12m IS NOT NULL;

-- Composite index for benchmark calculation queries
CREATE INDEX IF NOT EXISTS idx_history_period_geo_peer
  ON propertyiq_scores_history(period_date, geography_type, peer_group_id);

-- ============================================================================
-- FOREIGN KEY (optional, depends on data integrity needs)
-- ============================================================================
-- Note: Not adding FK to peer_group_id to avoid constraint issues during population
-- The peer group assignment script will ensure consistency

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT ON backtest_peer_groups TO authenticated;
GRANT SELECT ON backtest_benchmarks TO authenticated;
GRANT SELECT ON backtest_regional_benchmarks TO authenticated;
GRANT SELECT ON backtest_peer_benchmarks TO authenticated;
