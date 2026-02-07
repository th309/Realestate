-- ============================================================================
-- Add Resource Gating Features
-- Migration: 100
--
-- Extends feature system to support metric and geography level gating
-- ============================================================================

BEGIN;

-- ============================================================================
-- FEATURE DEFINITIONS: Metrics Access
-- Each metric gets a feature definition with access level
-- ============================================================================

-- Core metrics (free tier)
INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('metric_home_value', 'Home Value Metric', 'metrics', 'boolean', 'true'),
  ('metric_population', 'Population Metric', 'metrics', 'boolean', 'true'),
  ('metric_piq_score', 'PropertyIQ Score', 'metrics', 'boolean', 'true'),
  ('metric_median_income', 'Median Income Metric', 'metrics', 'boolean', 'true')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, updated_at = NOW();

-- Premium metrics (pro tier)
INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('metric_rental_yield', 'Rental Yield Metric', 'metrics', 'boolean', 'false'),
  ('metric_cap_rate', 'Cap Rate Metric', 'metrics', 'boolean', 'false'),
  ('metric_rent_index', 'Rent Index Metric', 'metrics', 'boolean', 'false'),
  ('metric_days_on_market', 'Days on Market Metric', 'metrics', 'boolean', 'false'),
  ('metric_inventory', 'Inventory Metric', 'metrics', 'boolean', 'false'),
  ('metric_price_cuts', 'Price Cuts Metric', 'metrics', 'boolean', 'false')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, updated_at = NOW();

-- Enterprise metrics
INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('metric_forecast', 'Forecast Metrics', 'metrics', 'boolean', 'false'),
  ('metric_custom_analytics', 'Custom Analytics', 'metrics', 'boolean', 'false')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, updated_at = NOW();

-- ============================================================================
-- FEATURE DEFINITIONS: Geography Access
-- ============================================================================

INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('geo_national', 'National Level Access', 'geography', 'boolean', 'true'),
  ('geo_state', 'State Level Access', 'geography', 'boolean', 'true'),
  ('geo_metro', 'Metro Level Access', 'geography', 'boolean', 'true'),
  ('geo_county', 'County Level Access', 'geography', 'boolean', 'false'),
  ('geo_zip', 'ZIP Code Level Access', 'geography', 'boolean', 'false'),
  ('geo_tract', 'Census Tract Access', 'geography', 'boolean', 'false')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, updated_at = NOW();

-- ============================================================================
-- FEATURE DEFINITIONS: Preview Limits (for teaser mode)
-- ============================================================================

INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('preview_metrics_limit', 'Preview Metrics Limit', 'preview', 'integer', '3'),
  ('preview_markets_limit', 'Preview Markets Limit', 'preview', 'integer', '5'),
  ('preview_timeseries_months', 'Preview Time Series Months', 'preview', 'integer', '6')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, updated_at = NOW();

-- ============================================================================
-- TIER FEATURES: Free Tier
-- ============================================================================

-- Metrics for free tier
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free' AND f.slug IN ('metric_home_value', 'metric_population', 'metric_piq_score', 'metric_median_income')
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Geographies for free tier
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free' AND f.slug IN ('geo_national', 'geo_state', 'geo_metro')
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Preview limits for free tier
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id,
  CASE f.slug
    WHEN 'preview_metrics_limit' THEN '3'::jsonb
    WHEN 'preview_markets_limit' THEN '5'::jsonb
    WHEN 'preview_timeseries_months' THEN '6'::jsonb
  END
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free' AND f.slug LIKE 'preview_%'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- TIER FEATURES: Pro Tier
-- ============================================================================

-- All metrics for pro tier
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'pro' AND f.category = 'metrics' AND f.slug NOT LIKE 'metric_custom%' AND f.slug NOT LIKE 'metric_forecast%'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- More geographies for pro tier
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'pro' AND f.category = 'geography' AND f.slug != 'geo_tract'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- No preview limits for pro (unlimited)
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '-1'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'pro' AND f.slug LIKE 'preview_%'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- TIER FEATURES: Enterprise Tier
-- ============================================================================

-- All metrics and geographies for enterprise
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'enterprise' AND f.category IN ('metrics', 'geography')
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- No limits for enterprise
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '-1'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'enterprise' AND f.slug LIKE 'preview_%'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;
