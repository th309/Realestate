-- Gate the 5 new Redfin Data Center display metrics like other premium metrics.
--
-- Without a feature_definitions row, EntitlementsService resolves a metric to
-- `level: 'none'` (fully blocked, even for admin). These rows put the metrics on
-- the standard per-metric gating: Pro-gated (free=false; pro/enterprise/admin=
-- true), the dominant pattern (55 of 69 metric features). County/ZIP is further
-- gated by the existing geo_county / geo_zip features. Idempotent.

INSERT INTO feature_definitions (slug, name, category, value_type, default_value, is_active, is_enforced)
VALUES
  ('metric_sold_above_list_share',     'Sold Above List %',      'metrics', 'boolean', 'false'::jsonb, true, true),
  ('metric_listings_delisted_share',   'Delisting Share %',      'metrics', 'boolean', 'false'::jsonb, true, true),
  ('metric_pending_cancellation_share','Sale Cancellation %',    'metrics', 'boolean', 'false'::jsonb, true, true),
  ('metric_investor_market_share',     'Investor Market Share %','metrics', 'boolean', 'false'::jsonb, true, true),
  ('metric_all_cash_share',            'All-Cash Purchase %',    'metrics', 'boolean', 'false'::jsonb, true, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tier_features (tier_id, feature_id, value)
SELECT st.id, fd.id,
       CASE WHEN st.slug = 'free' THEN 'false'::jsonb ELSE 'true'::jsonb END
FROM feature_definitions fd
CROSS JOIN subscription_tiers st
WHERE fd.slug IN (
        'metric_sold_above_list_share', 'metric_listings_delisted_share',
        'metric_pending_cancellation_share', 'metric_investor_market_share',
        'metric_all_cash_share')
  AND st.slug IN ('free', 'pro', 'enterprise', 'admin')
  AND NOT EXISTS (
        SELECT 1 FROM tier_features tf
        WHERE tf.tier_id = st.id AND tf.feature_id = fd.id);
