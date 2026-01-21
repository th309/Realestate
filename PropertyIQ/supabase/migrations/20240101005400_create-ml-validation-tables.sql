-- Migration: Create ML Validation Tables
-- Purpose: Store ML validation results for comparing formula-based scores against AutoGluon predictions

-- Store ML validation run results
CREATE TABLE IF NOT EXISTS propertyiq_ml_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_type VARCHAR(20) NOT NULL,
  geography_type VARCHAR(10) NOT NULL,
  horizon VARCHAR(10) NOT NULL,

  -- Time periods
  train_period_start DATE NOT NULL,
  train_period_end DATE NOT NULL,
  test_period_start DATE NOT NULL,
  test_period_end DATE NOT NULL,

  -- Config
  ml_preset VARCHAR(20) NOT NULL,
  time_limit_seconds INTEGER NOT NULL,

  -- Formula metrics
  formula_r2 DECIMAL(6,4),
  formula_directional_accuracy DECIMAL(5,4),
  formula_mae DECIMAL(8,4),
  formula_rmse DECIMAL(8,4),
  formula_quintile_spread DECIMAL(8,4),

  -- ML metrics
  ml_r2 DECIMAL(6,4),
  ml_directional_accuracy DECIMAL(5,4),
  ml_mae DECIMAL(8,4),
  ml_rmse DECIMAL(8,4),
  ml_quintile_spread DECIMAL(8,4),

  -- Full results as JSONB
  feature_importance JSONB,
  suggested_weights JSONB,
  suggested_metrics JSONB,
  subgroup_analysis JSONB,
  ml_leaderboard JSONB,

  -- Execution metadata
  training_time_seconds DECIMAL(8,2),
  test_samples INTEGER,
  features_used INTEGER,

  -- Status: 'ok', 'review', 'action_required'
  status VARCHAR(20) DEFAULT 'ok',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups by score type, geography, and horizon
CREATE INDEX IF NOT EXISTS idx_ml_validations_lookup ON propertyiq_ml_validations(
  score_type, geography_type, horizon, created_at DESC
);

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_ml_validations_status ON propertyiq_ml_validations(status);

-- Background job tracking table
CREATE TABLE IF NOT EXISTS propertyiq_ml_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'queued',  -- 'queued', 'running', 'completed', 'failed'
  progress DECIMAL(5,2) DEFAULT 0,
  result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for job status queries
CREATE INDEX IF NOT EXISTS idx_ml_jobs_status ON propertyiq_ml_jobs(status, created_at DESC);

-- Index for job type lookups
CREATE INDEX IF NOT EXISTS idx_ml_jobs_type ON propertyiq_ml_jobs(job_type, created_at DESC);

-- Store automated backtest run metadata
CREATE TABLE IF NOT EXISTS propertyiq_backtest_runs (
  id VARCHAR(50) PRIMARY KEY,  -- e.g., 'backtest_20260101_020000'

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_seconds DECIMAL(10,2),

  -- Config
  config JSONB NOT NULL,

  -- Summary
  total_geographies_tested INTEGER,
  total_score_calculations INTEGER,
  status VARCHAR(20) NOT NULL,  -- 'healthy', 'review_needed', 'action_required'

  -- Results (full matrix: score x horizon x geo_type)
  results JSONB NOT NULL,

  -- Alerts generated
  alert_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_backtest_runs_date ON propertyiq_backtest_runs(started_at DESC);

-- Index for status-based filtering
CREATE INDEX IF NOT EXISTS idx_backtest_runs_status ON propertyiq_backtest_runs(status);

-- Store sample definitions for reproducibility
CREATE TABLE IF NOT EXISTS propertyiq_backtest_samples (
  id SERIAL PRIMARY KEY,
  run_id VARCHAR(50) REFERENCES propertyiq_backtest_runs(id) ON DELETE CASCADE,
  geography_type VARCHAR(10) NOT NULL,
  sample_size INTEGER NOT NULL,
  geography_ids TEXT[] NOT NULL,  -- Array of geography IDs in sample
  sampling_method VARCHAR(20) NOT NULL,  -- 'full', 'stratified'
  strata_config JSONB,  -- Stratification parameters used

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for run lookups
CREATE INDEX IF NOT EXISTS idx_backtest_samples_run ON propertyiq_backtest_samples(run_id);

-- Grant permissions to service role
GRANT ALL ON propertyiq_ml_validations TO service_role;
GRANT ALL ON propertyiq_ml_jobs TO service_role;
GRANT ALL ON propertyiq_backtest_runs TO service_role;
GRANT ALL ON propertyiq_backtest_samples TO service_role;
GRANT USAGE, SELECT ON SEQUENCE propertyiq_backtest_samples_id_seq TO service_role;

-- Add comments for documentation
COMMENT ON TABLE propertyiq_ml_validations IS 'Stores ML validation results comparing formula scores vs AutoGluon predictions';
COMMENT ON TABLE propertyiq_ml_jobs IS 'Tracks background ML validation job status';
COMMENT ON TABLE propertyiq_backtest_runs IS 'Stores automated backtest run metadata and results';
COMMENT ON TABLE propertyiq_backtest_samples IS 'Stores stratified sampling details for backtest runs';
