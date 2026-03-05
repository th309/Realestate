-- ============================================================================
-- Add feature_ai_insights Access Gate
-- Migration: 20260304000100
--
-- The AmbientInsight and ScoreCard components use EntitlementGate with
-- type="feature" id="ai_insights", which resolves to the slug
-- "feature_ai_insights". The seed script already registers this slug in
-- feature_definitions, but the definition may be missing on older
-- environments. More importantly, NO tier assignments existed, so
-- getAccess returned { level: 'none' } for all users.
--
-- This migration:
--   1. Upserts the feature_ai_insights definition as integer type so
--      free-tier users get preview (value=1 → level='preview') while
--      paid tiers get full access (value=-1 → level='full').
--   2. Assigns tier values:
--        - free:       1   (preview — shows truncated/teaser content)
--        - pro:       -1   (full)
--        - enterprise: -1  (full)
--        - admin:     -1   (full)
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Upsert feature_ai_insights definition
-- ============================================================================

INSERT INTO feature_definitions (slug, name, category, value_type, default_value, is_active, is_enforced) VALUES
  ('feature_ai_insights', 'AI Market Insights', 'features', 'integer', '0', true, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  default_value = EXCLUDED.default_value,
  is_active = EXCLUDED.is_active,
  is_enforced = EXCLUDED.is_enforced,
  updated_at = NOW();

-- ============================================================================
-- SECTION 2: Free tier — preview access (value=1 → level='preview')
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '1'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free'
  AND f.slug = 'feature_ai_insights'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- SECTION 3: Pro, Enterprise, Admin tiers — full access (value=-1 → level='full')
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '-1'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug IN ('pro', 'enterprise', 'admin')
  AND f.slug = 'feature_ai_insights'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;
