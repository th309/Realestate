-- ============================================================================
-- Add feature_reports Boolean Access Gate
-- Migration: 20260225000100
--
-- The reports page uses EntitlementGate with type="feature" id="reports",
-- which resolves to the slug "feature_reports". However, this slug did NOT
-- exist in feature_definitions — only "feature_reports_monthly" (an integer
-- rate limit) was defined. As a result, getAccess returned { level: 'none' }
-- for ALL users (including Pro/Enterprise), causing every user to see the
-- "Unlock Market Reports" upsell.
--
-- This migration adds the missing boolean feature definition and grants it
-- to pro, enterprise, and admin tiers while keeping it false for free tier.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Add the missing feature_reports boolean definition
-- ============================================================================

INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('feature_reports', 'Reports Access', 'features', 'boolean', 'false')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  default_value = EXCLUDED.default_value,
  updated_at = NOW();

-- ============================================================================
-- SECTION 2: Free tier — reports gated (false)
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'false'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free'
  AND f.slug = 'feature_reports'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- SECTION 3: Pro, Enterprise, Admin tiers — reports enabled (true)
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug IN ('pro', 'enterprise', 'admin')
  AND f.slug = 'feature_reports'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;
