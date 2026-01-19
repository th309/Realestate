-- Migration 036: Add indexes to Zillow long-format tables
-- These indexes are critical for query performance

BEGIN;

-- ============================================================================
-- Indexes for zillow_state
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_zillow_state_date_metric
  ON zillow_state(period_date, metric_name);
CREATE INDEX IF NOT EXISTS idx_zillow_state_metric_date
  ON zillow_state(metric_name, period_date DESC);

-- ============================================================================
-- Indexes for zillow_metro
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_zillow_metro_date_metric
  ON zillow_metro(period_date, metric_name);
CREATE INDEX IF NOT EXISTS idx_zillow_metro_metric_date
  ON zillow_metro(metric_name, period_date DESC);

-- ============================================================================
-- Indexes for zillow_county
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_zillow_county_date_metric
  ON zillow_county(period_date, metric_name);
CREATE INDEX IF NOT EXISTS idx_zillow_county_metric_date
  ON zillow_county(metric_name, period_date DESC);

-- ============================================================================
-- Indexes for zillow_city
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_zillow_city_date_metric
  ON zillow_city(period_date, metric_name);
CREATE INDEX IF NOT EXISTS idx_zillow_city_metric_date
  ON zillow_city(metric_name, period_date DESC);

-- ============================================================================
-- Indexes for zillow_zip
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_zillow_zip_date_metric
  ON zillow_zip(period_date, metric_name);
CREATE INDEX IF NOT EXISTS idx_zillow_zip_metric_date
  ON zillow_zip(metric_name, period_date DESC);

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 036 completed: Added indexes to Zillow tables';
END $$;
