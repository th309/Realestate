-- ============================================================================
-- Migration 051: Create News Cache Table for Gemini
-- ============================================================================
-- Creates the report_news_cache table for caching Gemini news scout results
-- ============================================================================

-- Drop the old simple table if it exists
DROP TABLE IF EXISTS report_news_cache;

-- Create the enhanced news cache table
CREATE TABLE report_news_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Geography identifiers
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  geography_name TEXT NOT NULL,

  -- Full Gemini scout result (stored as JSONB)
  news_data JSONB NOT NULL,

  -- Extracted counts for quick filtering/stats
  local_news_count INTEGER,
  indicators_count INTEGER,
  signals_count INTEGER,

  -- Overall market signal direction (for quick queries)
  overall_signal TEXT, -- 'bullish', 'bearish', 'neutral', 'mixed'

  -- Cache management
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Gemini metadata
  model_used TEXT,
  processing_time_ms INTEGER,

  -- Ensure one cache entry per geography
  CONSTRAINT unique_geography_cache UNIQUE (geography_id, geography_type)
);

-- Indexes for common queries
CREATE INDEX idx_news_cache_geography
  ON report_news_cache(geography_id, geography_type);

CREATE INDEX idx_news_cache_expires
  ON report_news_cache(expires_at);

CREATE INDEX idx_news_cache_signal
  ON report_news_cache(overall_signal)
  WHERE overall_signal IS NOT NULL;

CREATE INDEX idx_news_cache_recent
  ON report_news_cache(fetched_at DESC);

-- Function to automatically set overall_signal on insert/update
CREATE OR REPLACE FUNCTION calculate_overall_signal()
RETURNS TRIGGER AS $$
DECLARE
  bullish_count INTEGER;
  bearish_count INTEGER;
BEGIN
  -- Count signals by type
  SELECT
    COUNT(*) FILTER (WHERE signal->>'signal_type' = 'bullish'),
    COUNT(*) FILTER (WHERE signal->>'signal_type' = 'bearish')
  INTO bullish_count, bearish_count
  FROM jsonb_array_elements(NEW.news_data->'market_signals') AS signal;

  -- Determine overall signal
  IF bullish_count > bearish_count + 1 THEN
    NEW.overall_signal := 'bullish';
  ELSIF bearish_count > bullish_count + 1 THEN
    NEW.overall_signal := 'bearish';
  ELSIF bullish_count = 0 AND bearish_count = 0 THEN
    NEW.overall_signal := 'neutral';
  ELSE
    NEW.overall_signal := 'mixed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_overall_signal
  BEFORE INSERT OR UPDATE ON report_news_cache
  FOR EACH ROW
  EXECUTE FUNCTION calculate_overall_signal();

-- View for easy querying of recent news by geography
CREATE OR REPLACE VIEW news_cache_summary AS
SELECT
  geography_id,
  geography_type,
  geography_name,
  local_news_count,
  indicators_count,
  signals_count,
  overall_signal,
  fetched_at,
  expires_at,
  CASE WHEN expires_at > NOW() THEN 'fresh' ELSE 'stale' END AS cache_status,
  EXTRACT(EPOCH FROM (expires_at - NOW())) / 3600 AS hours_until_expiry
FROM report_news_cache
ORDER BY fetched_at DESC;

-- Function to get fresh or scout news (for use in SQL if needed)
CREATE OR REPLACE FUNCTION get_news_cache_status(
  p_geography_id TEXT,
  p_geography_type TEXT
)
RETURNS TABLE (
  is_cached BOOLEAN,
  is_fresh BOOLEAN,
  fetched_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  news_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE AS is_cached,
    nc.expires_at > NOW() AS is_fresh,
    nc.fetched_at,
    nc.expires_at,
    nc.news_data
  FROM report_news_cache nc
  WHERE nc.geography_id = p_geography_id
    AND nc.geography_type = p_geography_type
  ORDER BY nc.fetched_at DESC
  LIMIT 1;

  -- If no rows returned, return a "not cached" row
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE AS is_cached,
      FALSE AS is_fresh,
      NULL::TIMESTAMPTZ AS fetched_at,
      NULL::TIMESTAMPTZ AS expires_at,
      NULL::JSONB AS news_data;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for expired entries (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_news_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM report_news_cache
  WHERE expires_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON report_news_cache TO authenticated;
GRANT SELECT ON news_cache_summary TO authenticated;
