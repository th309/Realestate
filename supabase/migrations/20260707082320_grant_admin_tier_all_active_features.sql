-- Grant the admin tier every active feature at full access.
--
-- Root cause: entitlement resolution is purely data-driven with NO admin
-- wildcard, so the admin tier is all-access ONLY if `tier_features` is
-- exhaustively seeded. That seed drifted — `mcp_access`, `api_access`,
-- `embed_builder`, `embeddable_widgets` and the `preview_*` limits had no admin
-- grant, so a super_admin hit "Pro or Enterprise subscription required" on MCP
-- connect (confirmed live for troy@propertyiq.app). The application-layer fix
-- adds an admin all-access wildcard in UserFeaturesService.getUserFeatures();
-- this migration makes the `tier_features` table itself consistent so anything
-- reading it directly (admin feature matrices, Redis tier-cached entitlement
-- responses) also reflects admin-as-all-access.
--
-- Value by type mirrors the app wildcard + the enterprise seed:
--   boolean       -> true
--   integer limit -> -1  (unlimited)
--   other         -> the feature's own default_value
--
-- Idempotent + self-healing: inserts ONLY the grants the admin tier is missing
-- (NOT EXISTS), ON CONFLICT DO NOTHING. Safe to re-run and covers any future
-- feature added after this migration.

WITH admin_tier AS (
  SELECT id FROM subscription_tiers WHERE slug = 'admin'
)
INSERT INTO tier_features (id, tier_id, feature_id, value, created_at, updated_at)
SELECT
  gen_random_uuid(),
  at.id,
  fd.id,
  CASE fd.value_type
    WHEN 'boolean' THEN 'true'::jsonb
    WHEN 'integer' THEN '-1'::jsonb
    ELSE fd.default_value
  END,
  now(),
  now()
FROM feature_definitions fd
CROSS JOIN admin_tier at
WHERE fd.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM tier_features tf
    WHERE tf.tier_id = at.id
      AND tf.feature_id = fd.id
  )
ON CONFLICT (tier_id, feature_id) DO NOTHING;
