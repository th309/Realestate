-- Widen the insight_type CHECK to allow the forecast narrative used by the
-- /forecast SEO pages. MANDATORY before any generation runs: shipping a new
-- insight type without widening this CHECK makes every insert silently fail
-- (see 20260621205147_allow_market_outlook_insight_type.sql for the incident).

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
    'market_outlook',
    'market_forecast'
  ));
