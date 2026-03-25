-- Migration 120: Add monthly_report_limit feature definition

-- Add feature definition
INSERT INTO feature_definitions (slug, name, description, category, value_type)
VALUES ('monthly_report_limit', 'Monthly Report Limit', 'Maximum reports per month per organization', 'usage', 'number')
ON CONFLICT (slug) DO NOTHING;

-- Set tier values (free: 3, pro: 10, enterprise: unlimited, admin: unlimited)
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT st.id, fd.id,
  (CASE st.slug
    WHEN 'free' THEN '3'
    WHEN 'pro' THEN '10'
    WHEN 'enterprise' THEN '-1'
    WHEN 'admin' THEN '-1'
  END)::jsonb
FROM subscription_tiers st
CROSS JOIN feature_definitions fd
WHERE fd.slug = 'monthly_report_limit'
  AND st.slug IN ('free', 'pro', 'enterprise', 'admin')
ON CONFLICT DO NOTHING;
