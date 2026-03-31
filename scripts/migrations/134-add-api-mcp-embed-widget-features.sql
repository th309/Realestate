-- Migration 134: Add entitlement features for API, MCP, Embeds, and Widgets
-- Pro: personal API keys + MCP server access (Claude/ChatGPT integration)
-- Enterprise: embeddable widgets + embed builder (in addition to Pro features)

BEGIN;

-- ============================================================================
-- FEATURE DEFINITIONS
-- ============================================================================

INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('api_access', 'REST API Access', 'features', 'boolean', 'false'),
  ('mcp_access', 'MCP Server Access', 'features', 'boolean', 'false'),
  ('embed_builder', 'Embed Builder', 'features', 'boolean', 'false'),
  ('embeddable_widgets', 'Embeddable Widgets', 'features', 'boolean', 'false')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  updated_at = NOW();

-- ============================================================================
-- PRO TIER: API access + MCP access
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'pro' AND f.slug IN ('api_access', 'mcp_access')
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- ENTERPRISE TIER: All four features
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'enterprise' AND f.slug IN ('api_access', 'mcp_access', 'embed_builder', 'embeddable_widgets')
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;
