-- ============================================================================
-- V2 Entitlements Features
-- Migration: 20260218000100
--
-- Adds V2 feature definitions for score breakdown, rate limits, retention,
-- and Stripe integration columns. Expands free tier headline metrics from
-- 4 to 10. Pre-launch migration — no existing users affected.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Add Stripe columns to subscription_tiers
-- ============================================================================

ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR;
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS stripe_price_monthly_id VARCHAR;
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS stripe_price_yearly_id VARCHAR;

-- ============================================================================
-- SECTION 2: Add subscription fields to user_profiles (IF NOT EXISTS)
-- ============================================================================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR DEFAULT 'free';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_status VARCHAR DEFAULT 'none';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR;

-- ============================================================================
-- SECTION 3: New V2 feature definitions
-- ============================================================================

INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  -- Score features
  ('feature_score_breakdown', 'Score Component Breakdown', 'scores', 'boolean', 'false'),
  ('feature_score_history', 'Score History Access', 'scores', 'boolean', 'false'),
  ('feature_score_weights', 'Score Component Weights', 'scores', 'boolean', 'false'),

  -- Rate limit features
  ('feature_reports_monthly', 'Monthly Report Limit', 'limits', 'integer', '2'),
  ('feature_ai_analysis_monthly', 'Monthly AI Analysis Limit', 'limits', 'integer', '0'),

  -- Retention / history
  ('feature_history_months', 'Historical Trend Months', 'analytics', 'integer', '12'),

  -- Engagement features
  ('feature_weekly_digest', 'Weekly Email Digest', 'engagement', 'boolean', 'false'),
  ('feature_benchmarking', 'Metric Benchmarking', 'analytics', 'boolean', 'false'),
  ('feature_recommendations', 'Markets to Watch', 'analytics', 'boolean', 'false')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  default_value = EXCLUDED.default_value,
  updated_at = NOW();

-- ============================================================================
-- SECTION 4: New free-tier metric feature definitions (expand from 4 to 10+)
-- These are NEW metric slugs that don't exist yet in feature_definitions.
-- ============================================================================

INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('metric_home_value_yoy', 'Home Value YoY Change', 'metrics', 'boolean', 'true'),
  ('metric_median_listing_price', 'Median Listing Price', 'metrics', 'boolean', 'true'),
  ('metric_population_growth', 'Population Growth', 'metrics', 'boolean', 'true'),
  ('metric_homeownership_rate', 'Homeownership Rate', 'metrics', 'boolean', 'true'),
  ('metric_unemployment', 'Unemployment Rate', 'metrics', 'boolean', 'true')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  default_value = EXCLUDED.default_value,
  updated_at = NOW();

-- ============================================================================
-- SECTION 5: Grant new metrics to free tier
-- ============================================================================

-- Grant the 5 newly-defined metric features to free tier
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free'
  AND f.slug IN (
    'metric_home_value_yoy',
    'metric_median_listing_price',
    'metric_population_growth',
    'metric_homeownership_rate',
    'metric_unemployment'
  )
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Grant metric_inventory and metric_days_on_market to free tier
-- (these features already exist but were Pro-only)
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free'
  AND f.slug IN ('metric_inventory', 'metric_days_on_market')
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Also grant new metrics to pro, enterprise, admin tiers for completeness
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug IN ('pro', 'enterprise', 'admin')
  AND f.slug IN (
    'metric_home_value_yoy',
    'metric_median_listing_price',
    'metric_population_growth',
    'metric_homeownership_rate',
    'metric_unemployment'
  )
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- SECTION 6: V2 feature values — FREE tier
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id,
  CASE f.slug
    WHEN 'feature_score_breakdown'    THEN 'false'::jsonb
    WHEN 'feature_score_history'      THEN 'false'::jsonb
    WHEN 'feature_score_weights'      THEN 'false'::jsonb
    WHEN 'feature_reports_monthly'    THEN '2'::jsonb
    WHEN 'feature_ai_analysis_monthly' THEN '0'::jsonb
    WHEN 'feature_history_months'     THEN '12'::jsonb
    WHEN 'feature_weekly_digest'      THEN 'false'::jsonb
    WHEN 'feature_benchmarking'       THEN 'false'::jsonb
    WHEN 'feature_recommendations'    THEN 'false'::jsonb
  END
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free'
  AND f.slug IN (
    'feature_score_breakdown', 'feature_score_history', 'feature_score_weights',
    'feature_reports_monthly', 'feature_ai_analysis_monthly', 'feature_history_months',
    'feature_weekly_digest', 'feature_benchmarking', 'feature_recommendations'
  )
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- SECTION 7: V2 feature values — PRO tier
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id,
  CASE f.slug
    WHEN 'feature_score_breakdown'    THEN 'true'::jsonb
    WHEN 'feature_score_history'      THEN 'true'::jsonb
    WHEN 'feature_score_weights'      THEN 'false'::jsonb
    WHEN 'feature_reports_monthly'    THEN '10'::jsonb
    WHEN 'feature_ai_analysis_monthly' THEN '20'::jsonb
    WHEN 'feature_history_months'     THEN '120'::jsonb
    WHEN 'feature_weekly_digest'      THEN 'true'::jsonb
    WHEN 'feature_benchmarking'       THEN 'true'::jsonb
    WHEN 'feature_recommendations'    THEN 'true'::jsonb
  END
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'pro'
  AND f.slug IN (
    'feature_score_breakdown', 'feature_score_history', 'feature_score_weights',
    'feature_reports_monthly', 'feature_ai_analysis_monthly', 'feature_history_months',
    'feature_weekly_digest', 'feature_benchmarking', 'feature_recommendations'
  )
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- SECTION 8: V2 feature values — ENTERPRISE tier
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id,
  CASE f.slug
    WHEN 'feature_score_breakdown'    THEN 'true'::jsonb
    WHEN 'feature_score_history'      THEN 'true'::jsonb
    WHEN 'feature_score_weights'      THEN 'true'::jsonb
    WHEN 'feature_reports_monthly'    THEN '50'::jsonb
    WHEN 'feature_ai_analysis_monthly' THEN '-1'::jsonb
    WHEN 'feature_history_months'     THEN '-1'::jsonb
    WHEN 'feature_weekly_digest'      THEN 'true'::jsonb
    WHEN 'feature_benchmarking'       THEN 'true'::jsonb
    WHEN 'feature_recommendations'    THEN 'true'::jsonb
  END
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'enterprise'
  AND f.slug IN (
    'feature_score_breakdown', 'feature_score_history', 'feature_score_weights',
    'feature_reports_monthly', 'feature_ai_analysis_monthly', 'feature_history_months',
    'feature_weekly_digest', 'feature_benchmarking', 'feature_recommendations'
  )
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- SECTION 9: V2 feature values — ADMIN tier (all enabled / unlimited)
-- ============================================================================

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id,
  CASE f.value_type
    WHEN 'boolean' THEN 'true'::jsonb
    WHEN 'integer' THEN '-1'::jsonb
    ELSE f.default_value
  END
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'admin'
  AND f.slug IN (
    'feature_score_breakdown', 'feature_score_history', 'feature_score_weights',
    'feature_reports_monthly', 'feature_ai_analysis_monthly', 'feature_history_months',
    'feature_weekly_digest', 'feature_benchmarking', 'feature_recommendations'
  )
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- SECTION 10: Update preview_timeseries_months for free tier from 6 to 12
-- ============================================================================

UPDATE tier_features
SET value = '12'::jsonb, updated_at = NOW()
WHERE tier_id = (SELECT id FROM subscription_tiers WHERE slug = 'free')
  AND feature_id = (SELECT id FROM feature_definitions WHERE slug = 'preview_timeseries_months');

COMMIT;
