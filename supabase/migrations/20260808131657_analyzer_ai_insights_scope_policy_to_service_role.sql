-- ---------------------------------------------------------------------------
-- Scope the analyzer_ai_insights RLS policy to service_role.
--
-- 20260806004306 created the policy without a TO clause:
--
--   CREATE POLICY analyzer_ai_insights_service_role_all
--     ON analyzer_ai_insights FOR ALL USING (true);
--
-- A policy with no TO clause defaults to PUBLIC, so despite the name it was
-- permissive-for-every-role with USING (true). Verified in pg_policy:
-- polroles = '{0}' (PUBLIC).
--
-- This was never exploitable: only postgres and service_role hold table
-- GRANTs, and service_role bypasses RLS anyway. But it meant RLS contributed
-- ZERO defense — the sole thing keeping the table private was the absence of a
-- GRANT to anon/authenticated. Any future grant, or exposing the table via the
-- Data API, would have opened every row with no other change required.
--
-- (The 20260806004306 header comment claims "RLS is on with no permissive
-- policy and only service_role is granted". The grant half was true; the
-- policy half was not. That file is left untouched — it is already applied —
-- and this migration is the correction of record.)
--
-- Behavior is unchanged for the backend: AiInsightsStore uses the service-role
-- client, which bypasses RLS either way. This only removes the latent hole.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS analyzer_ai_insights_service_role_all
  ON analyzer_ai_insights;

CREATE POLICY analyzer_ai_insights_service_role_all
  ON analyzer_ai_insights FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE analyzer_ai_insights IS
  'Durable cache of analyzer AI narratives. Keyed by the same composite fingerprint as the Redis layer; invalidated by key change (deal edit or monthly rescore), not by TTL. Backend-only: service_role holds the sole GRANT and the sole RLS policy; anon/authenticated deliberately get nothing.';
