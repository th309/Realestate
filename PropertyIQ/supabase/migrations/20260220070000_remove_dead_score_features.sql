-- ============================================================================
-- Remove Dead Score-Related Feature Definitions
-- Migration: 20260220070000
--
-- Removes three score-related features from the entitlements system that are
-- either redundant or completely unimplemented in the frontend:
--
--   1. metric_piq_score     - Redundant with `feature_scores` (the actual
--                             entitlement the frontend checks). No frontend
--                             component ever checks `metric:piq_score` as an
--                             entitlement gate. Added in migration 005800 as
--                             a metric-level feature, but the score access
--                             check was later consolidated under
--                             `feature_scores`.
--
--   2. feature_score_history - Defined in migration 20260218000100 (V2
--                             entitlements) but has ZERO frontend
--                             implementation. No component, hook, or utility
--                             checks this entitlement. Removing to avoid
--                             confusion with the actually-used features.
--
--   3. feature_score_weights - Same situation as feature_score_history:
--                             defined in the DB but never referenced by any
--                             frontend code. No UI exists to display score
--                             component weights behind this gate.
--
-- KEPT (actively used):
--   - feature_scores / scores      - Base score access (checked by frontend)
--   - feature_score_breakdown      - PRO badge + component breakdown UI
--
-- NOTE: tier_features and user_feature_overrides have ON DELETE CASCADE on
-- feature_id, so deleting from feature_definitions would cascade. However,
-- we explicitly delete from dependent tables first for clarity and safety,
-- especially since user_grandfathering does NOT have ON DELETE CASCADE.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Delete from tier_features (FK child of feature_definitions)
-- This removes the tier-level grants for all subscription tiers (free, pro,
-- enterprise, admin) that reference the dead features.
-- ============================================================================

DELETE FROM tier_features
WHERE feature_id IN (
  SELECT id FROM feature_definitions
  WHERE slug IN (
    'metric_piq_score',
    'feature_score_history',
    'feature_score_weights'
  )
);

-- ============================================================================
-- STEP 2: Delete from user_feature_overrides (FK child with CASCADE)
-- Clean up any per-user overrides that might reference these features.
-- Pre-launch this should be empty, but defensive cleanup is good practice.
-- ============================================================================

DELETE FROM user_feature_overrides
WHERE feature_id IN (
  SELECT id FROM feature_definitions
  WHERE slug IN (
    'metric_piq_score',
    'feature_score_history',
    'feature_score_weights'
  )
);

-- ============================================================================
-- STEP 3: Clean up user_grandfathering references (FK without CASCADE)
-- This FK does NOT cascade, so we must nullify references before deleting
-- the feature definitions. Pre-launch this table should be empty.
-- ============================================================================

UPDATE user_grandfathering
SET feature_id = NULL
WHERE feature_id IN (
  SELECT id FROM feature_definitions
  WHERE slug IN (
    'metric_piq_score',
    'feature_score_history',
    'feature_score_weights'
  )
);

-- ============================================================================
-- STEP 4: Delete the feature definitions themselves
--
--   metric_piq_score      - Redundant with feature_scores; no frontend checks
--   feature_score_history  - Defined but never implemented in any UI
--   feature_score_weights  - Defined but never implemented in any UI
-- ============================================================================

DELETE FROM feature_definitions
WHERE slug IN (
  'metric_piq_score',
  'feature_score_history',
  'feature_score_weights'
);

COMMIT;
