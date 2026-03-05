-- ============================================================================
-- Add Personalization Feature Access Gates
-- Migration: 20260304000200
--
-- Adds entitlement gates for the onboarding quiz, market match,
-- personalized dashboard, and markets-to-watch features introduced in
-- the personalization phase.
--
-- Feature / Tier matrix:
--   onboarding_quiz:        all tiers = full (-1)
--   market_match:           free = preview/metro-only (1), pro/enterprise/admin = full (-1)
--   personalized_dashboard: free = preview/top-3 (3), pro/enterprise/admin = full (-1)
--   markets_to_watch:       free = none (0), pro/enterprise/admin = full (-1)
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Upsert feature definitions
-- ============================================================================

INSERT INTO feature_definitions (slug, name, category, value_type, default_value, is_active, is_enforced) VALUES
  ('feature_onboarding_quiz', 'Onboarding Quiz', 'features', 'integer', '-1', true, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  default_value = EXCLUDED.default_value,
  is_active = EXCLUDED.is_active,
  is_enforced = EXCLUDED.is_enforced,
  updated_at = NOW();

INSERT INTO feature_definitions (slug, name, category, value_type, default_value, is_active, is_enforced) VALUES
  ('feature_market_match', 'Market Match Scores', 'features', 'integer', '0', true, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  default_value = EXCLUDED.default_value,
  is_active = EXCLUDED.is_active,
  is_enforced = EXCLUDED.is_enforced,
  updated_at = NOW();

INSERT INTO feature_definitions (slug, name, category, value_type, default_value, is_active, is_enforced) VALUES
  ('feature_personalized_dashboard', 'Personalized Dashboard', 'features', 'integer', '0', true, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  default_value = EXCLUDED.default_value,
  is_active = EXCLUDED.is_active,
  is_enforced = EXCLUDED.is_enforced,
  updated_at = NOW();

INSERT INTO feature_definitions (slug, name, category, value_type, default_value, is_active, is_enforced) VALUES
  ('feature_markets_to_watch', 'Markets to Watch', 'features', 'integer', '0', true, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  default_value = EXCLUDED.default_value,
  is_active = EXCLUDED.is_active,
  is_enforced = EXCLUDED.is_enforced,
  updated_at = NOW();

-- ============================================================================
-- SECTION 2: onboarding_quiz — all tiers get full access (value=-1)
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '-1'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug IN ('free', 'pro', 'enterprise', 'admin')
  AND f.slug = 'feature_onboarding_quiz'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- SECTION 3: market_match — free = preview/metro-only (1), paid = full (-1)
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '1'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free'
  AND f.slug = 'feature_market_match'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '-1'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug IN ('pro', 'enterprise', 'admin')
  AND f.slug = 'feature_market_match'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- SECTION 4: personalized_dashboard — free = preview/top-3 (3), paid = full (-1)
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '3'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free'
  AND f.slug = 'feature_personalized_dashboard'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '-1'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug IN ('pro', 'enterprise', 'admin')
  AND f.slug = 'feature_personalized_dashboard'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- SECTION 5: markets_to_watch — free = none (0), paid = full (-1)
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '0'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free'
  AND f.slug = 'feature_markets_to_watch'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '-1'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug IN ('pro', 'enterprise', 'admin')
  AND f.slug = 'feature_markets_to_watch'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;
