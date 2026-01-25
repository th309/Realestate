-- ============================================================================
-- Analytics Assistant Tables
-- Migration: 20240101005600
-- 
-- Creates tables for:
-- 1. User data (saved queries, watchlist, notes, alerts, shares, conversations)
-- 2. Feature configuration (tiers, features, tier_features, overrides)
-- 3. Grandfathering (user_grandfathering, policies, pricing history, audit)
-- ============================================================================

BEGIN;

-- ============================================================================
-- SUBSCRIPTION TIERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  badge_color TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FEATURE DEFINITIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS feature_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  value_type TEXT NOT NULL,
  default_value JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TIER FEATURES (the matrix)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tier_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id UUID REFERENCES subscription_tiers(id) ON DELETE CASCADE,
  feature_id UUID REFERENCES feature_definitions(id) ON DELETE CASCADE,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tier_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_tier_features_tier ON tier_features(tier_id);
CREATE INDEX IF NOT EXISTS idx_tier_features_feature ON tier_features(feature_id);

-- ============================================================================
-- USER FEATURE OVERRIDES
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature_id UUID REFERENCES feature_definitions(id) ON DELETE CASCADE,
  value JSONB NOT NULL,
  reason TEXT,
  granted_by UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_user_overrides_user ON user_feature_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_overrides_expires ON user_feature_overrides(expires_at) 
  WHERE expires_at IS NOT NULL;

-- ============================================================================
-- GRANDFATHERING
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_grandfathering (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  grandfathered_type TEXT NOT NULL,
  original_price_monthly DECIMAL(10,2),
  original_price_yearly DECIMAL(10,2),
  original_tier_slug TEXT,
  original_tier_snapshot JSONB,
  feature_id UUID REFERENCES feature_definitions(id),
  original_feature_value JSONB,
  reason TEXT NOT NULL,
  notes TEXT,
  grandfathered_at TIMESTAMPTZ DEFAULT NOW(),
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  granted_by UUID,
  grant_source TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  revoke_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grandfather_user ON user_grandfathering(user_id);
CREATE INDEX IF NOT EXISTS idx_grandfather_active ON user_grandfathering(user_id, is_active) 
  WHERE is_active = TRUE;

-- ============================================================================
-- GRANDFATHER POLICIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS grandfather_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_condition JSONB NOT NULL,
  grandfather_type TEXT NOT NULL,
  grandfather_config JSONB,
  duration_type TEXT NOT NULL,
  duration_months INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PRICING HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_slug TEXT NOT NULL,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_history_tier ON pricing_history(tier_slug, effective_from);

-- ============================================================================
-- FEATURE AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS feature_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- ============================================================================
-- ANALYTICS SAVED QUERIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics_saved_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  query_text TEXT NOT NULL,
  query_params JSONB,
  result_type TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_scheduled BOOLEAN DEFAULT FALSE,
  schedule_cron TEXT,
  schedule_email BOOLEAN DEFAULT FALSE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_queries_user ON analytics_saved_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_scheduled ON analytics_saved_queries(is_scheduled, next_run_at) 
  WHERE is_scheduled = TRUE;

-- ============================================================================
-- ANALYTICS WATCHLIST
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  geography_type TEXT NOT NULL,
  geography_id TEXT NOT NULL,
  geography_name TEXT,
  tags TEXT[],
  folder TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  score_at_add DECIMAL(5,2),
  UNIQUE(user_id, geography_type, geography_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON analytics_watchlist(user_id);

-- ============================================================================
-- ANALYTICS NOTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  geography_type TEXT NOT NULL,
  geography_id TEXT NOT NULL,
  content TEXT NOT NULL,
  reminder_at TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON analytics_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_geography ON analytics_notes(geography_type, geography_id);

-- ============================================================================
-- ANALYTICS ALERTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  condition JSONB NOT NULL,
  notify_email BOOLEAN DEFAULT TRUE,
  notify_inapp BOOLEAN DEFAULT TRUE,
  notify_sms BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON analytics_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON analytics_alerts(is_active, last_checked_at) 
  WHERE is_active = TRUE;

-- ============================================================================
-- ANALYTICS SHARES
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  content_type TEXT NOT NULL,
  content JSONB NOT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  password_hash TEXT,
  allowed_emails TEXT[],
  expires_at TIMESTAMPTZ,
  max_views INTEGER,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shares_token ON analytics_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_shares_user ON analytics_shares(user_id);

-- ============================================================================
-- ANALYTICS CONVERSATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id TEXT NOT NULL,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  context JSONB,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON analytics_conversations(user_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_grandfathering ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_saved_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_conversations ENABLE ROW LEVEL SECURITY;

-- Public read for tiers and features
CREATE POLICY "Public read subscription_tiers" ON subscription_tiers FOR SELECT USING (true);
CREATE POLICY "Public read feature_definitions" ON feature_definitions FOR SELECT USING (true);
CREATE POLICY "Public read tier_features" ON tier_features FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service role full access subscription_tiers" ON subscription_tiers FOR ALL USING (true);
CREATE POLICY "Service role full access feature_definitions" ON feature_definitions FOR ALL USING (true);
CREATE POLICY "Service role full access tier_features" ON tier_features FOR ALL USING (true);
CREATE POLICY "Service role full access user_feature_overrides" ON user_feature_overrides FOR ALL USING (true);
CREATE POLICY "Service role full access user_grandfathering" ON user_grandfathering FOR ALL USING (true);
CREATE POLICY "Service role full access analytics_saved_queries" ON analytics_saved_queries FOR ALL USING (true);
CREATE POLICY "Service role full access analytics_watchlist" ON analytics_watchlist FOR ALL USING (true);
CREATE POLICY "Service role full access analytics_notes" ON analytics_notes FOR ALL USING (true);
CREATE POLICY "Service role full access analytics_alerts" ON analytics_alerts FOR ALL USING (true);
CREATE POLICY "Service role full access analytics_shares" ON analytics_shares FOR ALL USING (true);
CREATE POLICY "Service role full access analytics_conversations" ON analytics_conversations FOR ALL USING (true);

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT ON subscription_tiers TO authenticated, anon;
GRANT SELECT ON feature_definitions TO authenticated, anon;
GRANT SELECT ON tier_features TO authenticated, anon;
GRANT ALL ON subscription_tiers TO service_role;
GRANT ALL ON feature_definitions TO service_role;
GRANT ALL ON tier_features TO service_role;
GRANT ALL ON user_feature_overrides TO service_role;
GRANT ALL ON user_grandfathering TO service_role;
GRANT ALL ON grandfather_policies TO service_role;
GRANT ALL ON pricing_history TO service_role;
GRANT ALL ON feature_audit_log TO service_role;
GRANT ALL ON analytics_saved_queries TO service_role;
GRANT ALL ON analytics_watchlist TO service_role;
GRANT ALL ON analytics_notes TO service_role;
GRANT ALL ON analytics_alerts TO service_role;
GRANT ALL ON analytics_shares TO service_role;
GRANT ALL ON analytics_conversations TO service_role;

COMMIT;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 005600 completed: Created Analytics Assistant tables';
END $$;
