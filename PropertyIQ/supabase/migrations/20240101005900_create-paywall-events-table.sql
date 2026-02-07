-- ============================================================================
-- Paywall Events Table
-- Migration: 101
--
-- Tracks user interactions with paywalls for analytics
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS paywall_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id VARCHAR(100),
  resource_type VARCHAR(50) NOT NULL,  -- 'metric', 'geography', 'feature'
  resource_id VARCHAR(100) NOT NULL,   -- 'rental_yield', 'zip', 'ai_insights'
  user_tier VARCHAR(50) NOT NULL,
  page_path VARCHAR(500),
  event_type VARCHAR(50) NOT NULL,     -- 'view', 'click_upgrade', 'dismiss'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_paywall_events_resource
  ON paywall_events(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paywall_events_time
  ON paywall_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paywall_events_user
  ON paywall_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paywall_events_type
  ON paywall_events(event_type, created_at DESC);

-- Grant permissions
GRANT SELECT, INSERT ON paywall_events TO service_role;
GRANT SELECT, INSERT ON paywall_events TO authenticated;

COMMIT;
