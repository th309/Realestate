-- Allow 'market_outlook' as a valid market_insights.insight_type.
--
-- The market_outlook insight type shipped with the AI predictive-hero landing
-- feature (commits f97b1a2e / e71c0687, plus AI-purpose seed 20260620173000),
-- but the market_insights CHECK constraint was never widened to permit it. As a
-- result every market_outlook insight FAILED to persist:
--   new row for relation "market_insights" violates check constraint
--   "market_insights_insight_type_check"
-- so it never cached, and the home page regenerated it via a 14-24s AI call on
-- EVERY render (perpetual "constantly rendering" + load-induced 500s).
--
-- This widens the constraint to include 'market_outlook', matching the
-- InsightType union in packages/backend/src/insights/insights.types.ts.
-- Idempotent (DROP IF EXISTS + ADD); the new CHECK is a strict superset of the
-- old one, so no existing row violates it.

ALTER TABLE market_insights
  DROP CONSTRAINT IF EXISTS market_insights_insight_type_check;

ALTER TABLE market_insights
  ADD CONSTRAINT market_insights_insight_type_check
  CHECK (insight_type IN (
    'market_take',
    'score_explanation',
    'trend_interpretation',
    'market_overview',
    'archetype_match',
    'market_outlook'
  ));
