-- ============================================================================
-- Seed Feature Configuration
-- Migration: 20240101005700
-- 
-- Seeds initial tiers and feature definitions for Analytics Assistant
-- ============================================================================

BEGIN;

-- ============================================================================
-- SEED: Subscription Tiers
-- ============================================================================
INSERT INTO subscription_tiers (slug, name, description, price_monthly, price_yearly, is_default, display_order, badge_color) VALUES
  ('free', 'Free', 'Basic access to PropertyIQ', 0, 0, TRUE, 1, '#6B7280'),
  ('pro', 'Pro', 'Full analytics and insights', 29, 290, FALSE, 2, '#4F46E5'),
  ('enterprise', 'Enterprise', 'Unlimited access + team features', 99, 990, FALSE, 3, '#059669'),
  ('admin', 'Admin', 'Internal admin access', NULL, NULL, FALSE, 99, '#DC2626')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  badge_color = EXCLUDED.badge_color,
  updated_at = NOW();

-- ============================================================================
-- SEED: Feature Definitions
-- ============================================================================
INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  -- Analytics
  ('analytics_assistant_enabled', 'Analytics Assistant Access', 'analytics', 'boolean', 'false'),
  ('analytics_queries_per_day', 'Daily Query Limit', 'analytics', 'integer', '0'),
  ('analytics_queries_per_session', 'Queries Per Session', 'analytics', 'integer', '0'),
  ('analytics_allowed_geographies', 'Allowed Geography Types', 'analytics', 'json', '[]'),
  ('compare_markets_enabled', 'Market Comparisons', 'analytics', 'boolean', 'false'),
  ('compare_markets_limit', 'Max Markets to Compare', 'analytics', 'integer', '0'),
  ('time_history_months', 'Historical Data Access (months)', 'analytics', 'integer', '0'),
  ('scenario_modeling_enabled', 'Scenario Modeling', 'analytics', 'boolean', 'false'),
  ('statistical_deep_dives', 'Statistical Deep Dives', 'analytics', 'boolean', 'false'),
  ('charts_enabled', 'Inline Charts', 'analytics', 'boolean', 'false'),
  ('mini_maps_enabled', 'Mini Maps', 'analytics', 'boolean', 'false'),
  
  -- Persistence
  ('saved_queries_enabled', 'Save Queries', 'persistence', 'boolean', 'false'),
  ('saved_queries_limit', 'Max Saved Queries', 'persistence', 'integer', '0'),
  ('watchlist_enabled', 'Market Watchlist', 'persistence', 'boolean', 'false'),
  ('watchlist_limit', 'Max Watchlist Markets', 'persistence', 'integer', '0'),
  ('notes_enabled', 'Market Notes', 'persistence', 'boolean', 'false'),
  ('conversation_history_enabled', 'Conversation History', 'persistence', 'boolean', 'false'),
  ('conversation_history_days', 'History Retention (days)', 'persistence', 'integer', '0'),
  
  -- Alerts
  ('alerts_enabled', 'Price/Score Alerts', 'alerts', 'boolean', 'false'),
  ('alerts_limit', 'Max Active Alerts', 'alerts', 'integer', '0'),
  ('scheduled_queries_enabled', 'Scheduled Query Reports', 'alerts', 'boolean', 'false'),
  
  -- Export
  ('export_csv_enabled', 'CSV Export', 'export', 'boolean', 'false'),
  ('export_api_enabled', 'API Export', 'export', 'boolean', 'false'),
  ('export_sheets_enabled', 'Google Sheets Export', 'export', 'boolean', 'false'),
  ('share_links_enabled', 'Shareable Links', 'export', 'boolean', 'false'),
  ('share_links_branded', 'Branded Share Links', 'export', 'boolean', 'false'),
  ('scheduled_exports_enabled', 'Scheduled Exports', 'export', 'boolean', 'false'),
  
  -- Collaboration
  ('team_enabled', 'Team Collaboration', 'collaboration', 'boolean', 'false'),
  ('team_members_limit', 'Max Team Members', 'collaboration', 'integer', '0'),
  ('shared_watchlists', 'Shared Watchlists', 'collaboration', 'boolean', 'false')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  default_value = EXCLUDED.default_value,
  updated_at = NOW();

-- ============================================================================
-- SEED: Free Tier Features (all disabled/zero)
-- ============================================================================
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT 
  t.id,
  f.id,
  f.default_value
FROM subscription_tiers t
CROSS JOIN feature_definitions f
WHERE t.slug = 'free'
ON CONFLICT (tier_id, feature_id) DO NOTHING;

-- ============================================================================
-- SEED: Pro Tier Features
-- ============================================================================
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT 
  (SELECT id FROM subscription_tiers WHERE slug = 'pro'),
  f.id,
  CASE f.slug
    WHEN 'analytics_assistant_enabled' THEN 'true'::jsonb
    WHEN 'analytics_queries_per_day' THEN '20'::jsonb
    WHEN 'analytics_queries_per_session' THEN '20'::jsonb
    WHEN 'analytics_allowed_geographies' THEN '["state", "metro"]'::jsonb
    WHEN 'compare_markets_enabled' THEN 'true'::jsonb
    WHEN 'compare_markets_limit' THEN '5'::jsonb
    WHEN 'time_history_months' THEN '12'::jsonb
    WHEN 'scenario_modeling_enabled' THEN 'false'::jsonb
    WHEN 'statistical_deep_dives' THEN 'false'::jsonb
    WHEN 'charts_enabled' THEN 'true'::jsonb
    WHEN 'mini_maps_enabled' THEN 'true'::jsonb
    WHEN 'saved_queries_enabled' THEN 'true'::jsonb
    WHEN 'saved_queries_limit' THEN '10'::jsonb
    WHEN 'watchlist_enabled' THEN 'true'::jsonb
    WHEN 'watchlist_limit' THEN '20'::jsonb
    WHEN 'notes_enabled' THEN 'true'::jsonb
    WHEN 'conversation_history_enabled' THEN 'true'::jsonb
    WHEN 'conversation_history_days' THEN '30'::jsonb
    WHEN 'alerts_enabled' THEN 'true'::jsonb
    WHEN 'alerts_limit' THEN '5'::jsonb
    WHEN 'scheduled_queries_enabled' THEN 'false'::jsonb
    WHEN 'export_csv_enabled' THEN 'true'::jsonb
    WHEN 'export_api_enabled' THEN 'false'::jsonb
    WHEN 'export_sheets_enabled' THEN 'false'::jsonb
    WHEN 'share_links_enabled' THEN 'true'::jsonb
    WHEN 'share_links_branded' THEN 'false'::jsonb
    WHEN 'scheduled_exports_enabled' THEN 'false'::jsonb
    WHEN 'team_enabled' THEN 'false'::jsonb
    WHEN 'team_members_limit' THEN '0'::jsonb
    WHEN 'shared_watchlists' THEN 'false'::jsonb
    ELSE f.default_value
  END
FROM feature_definitions f
ON CONFLICT (tier_id, feature_id) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ============================================================================
-- SEED: Enterprise Tier Features (unlimited)
-- ============================================================================
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT 
  (SELECT id FROM subscription_tiers WHERE slug = 'enterprise'),
  f.id,
  CASE f.slug
    WHEN 'analytics_assistant_enabled' THEN 'true'::jsonb
    WHEN 'analytics_queries_per_day' THEN '-1'::jsonb
    WHEN 'analytics_queries_per_session' THEN '-1'::jsonb
    WHEN 'analytics_allowed_geographies' THEN '["state", "metro", "county", "zip"]'::jsonb
    WHEN 'compare_markets_enabled' THEN 'true'::jsonb
    WHEN 'compare_markets_limit' THEN '-1'::jsonb
    WHEN 'time_history_months' THEN '-1'::jsonb
    WHEN 'scenario_modeling_enabled' THEN 'true'::jsonb
    WHEN 'statistical_deep_dives' THEN 'true'::jsonb
    WHEN 'charts_enabled' THEN 'true'::jsonb
    WHEN 'mini_maps_enabled' THEN 'true'::jsonb
    WHEN 'saved_queries_enabled' THEN 'true'::jsonb
    WHEN 'saved_queries_limit' THEN '-1'::jsonb
    WHEN 'watchlist_enabled' THEN 'true'::jsonb
    WHEN 'watchlist_limit' THEN '-1'::jsonb
    WHEN 'notes_enabled' THEN 'true'::jsonb
    WHEN 'conversation_history_enabled' THEN 'true'::jsonb
    WHEN 'conversation_history_days' THEN '-1'::jsonb
    WHEN 'alerts_enabled' THEN 'true'::jsonb
    WHEN 'alerts_limit' THEN '-1'::jsonb
    WHEN 'scheduled_queries_enabled' THEN 'true'::jsonb
    WHEN 'export_csv_enabled' THEN 'true'::jsonb
    WHEN 'export_api_enabled' THEN 'true'::jsonb
    WHEN 'export_sheets_enabled' THEN 'true'::jsonb
    WHEN 'share_links_enabled' THEN 'true'::jsonb
    WHEN 'share_links_branded' THEN 'true'::jsonb
    WHEN 'scheduled_exports_enabled' THEN 'true'::jsonb
    WHEN 'team_enabled' THEN 'true'::jsonb
    WHEN 'team_members_limit' THEN '25'::jsonb
    WHEN 'shared_watchlists' THEN 'true'::jsonb
    ELSE f.default_value
  END
FROM feature_definitions f
ON CONFLICT (tier_id, feature_id) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ============================================================================
-- SEED: Admin Tier Features (everything enabled, unlimited)
-- ============================================================================
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT 
  (SELECT id FROM subscription_tiers WHERE slug = 'admin'),
  f.id,
  CASE f.value_type
    WHEN 'boolean' THEN 'true'::jsonb
    WHEN 'integer' THEN '-1'::jsonb
    WHEN 'json' THEN '["state", "metro", "county", "zip"]'::jsonb
    ELSE f.default_value
  END
FROM feature_definitions f
ON CONFLICT (tier_id, feature_id) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

COMMIT;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 005700 completed: Seeded feature configuration';
END $$;
