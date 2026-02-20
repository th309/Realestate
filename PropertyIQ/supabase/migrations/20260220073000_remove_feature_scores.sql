-- ============================================================================
-- Remove Master "feature_scores" Entitlement
-- Migration: 20260220073000
--
-- Consolidates score entitlements by removing the master `feature_scores`
-- switch. Previously, score access required BOTH `feature_scores` (the master
-- gate) AND individual metric entitlements like `metric_homeready_score`,
-- `metric_investoredge_score`, and `metric_market_health_score`.
--
-- After this migration, each individual score metric controls its own access
-- independently. There is no longer a single on/off switch for all scores.
--
-- REMOVED:
--   - feature_scores  - Master "can see scores at all?" switch (redundant)
--
-- KEPT (actively used, now sole controllers of score access):
--   - metric_homeready_score    - Individual HomeReady score metric
--   - metric_investoredge_score - Individual InvestorEdge score metric
--   - metric_market_health_score - Individual Market Health score metric
--   - feature_score_breakdown   - PRO badge + component breakdown UI
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
-- enterprise, admin) that reference feature_scores.
-- ============================================================================

DELETE FROM tier_features
WHERE feature_id IN (
  SELECT id FROM feature_definitions
  WHERE slug = 'feature_scores'
);

-- ============================================================================
-- STEP 2: Delete from user_feature_overrides (FK child with CASCADE)
-- Clean up any per-user overrides that might reference this feature.
-- Pre-launch this should be empty, but defensive cleanup is good practice.
-- ============================================================================

DELETE FROM user_feature_overrides
WHERE feature_id IN (
  SELECT id FROM feature_definitions
  WHERE slug = 'feature_scores'
);

-- ============================================================================
-- STEP 3: Clean up user_grandfathering references (FK without CASCADE)
-- This FK does NOT cascade, so we must nullify references before deleting
-- the feature definition. Pre-launch this table should be empty.
-- ============================================================================

UPDATE user_grandfathering
SET feature_id = NULL
WHERE feature_id IN (
  SELECT id FROM feature_definitions
  WHERE slug = 'feature_scores'
);

-- ============================================================================
-- STEP 4: Delete the feature definition itself
--
-- feature_scores - Redundant master switch; individual score metrics
--                  (metric_homeready_score, metric_investoredge_score,
--                  metric_market_health_score) now each control their
--                  own access independently.
-- ============================================================================

DELETE FROM feature_definitions
WHERE slug = 'feature_scores';

COMMIT;
