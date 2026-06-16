-- Security remediation (2026-06-16): clears the safe WARN-level advisors.
-- Applied live to prod via execute_sql on 2026-06-16; this file tracks it in git.
--
-- function_search_path_mutable: pin search_path on our 14 public functions.
-- Non-breaking: 'public' was already the effective resolution schema; pg_catalog stays implicitly first.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'update_ai_marketing_insights_updated_at','user_profiles_broadcast_trigger',
      'propertyiq_scores_insert_trigger','get_top_markets_by_state','update_ai_model_config_timestamp',
      'update_eval_scores_timestamp','invite_org_member','compute_propertyiq_score_health',
      'aggregate_market_engagement','update_content_assets_updated_at','update_user_thresholds_timestamp',
      'compute_months_of_supply','update_ai_shadow_config_timestamp','refresh_screener_snapshot')
  LOOP EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig); END LOOP;
END $$;

-- pg-boss runtime functions (pgboss + pgboss_local schemas).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig, n.nspname AS sch
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('pgboss','pgboss_local') AND p.proname IN ('create_queue','delete_queue')
  LOOP EXECUTE format('ALTER FUNCTION %s SET search_path = %I, public', r.sig, r.sch); END LOOP;
END $$;

-- Drop leftover per-run E2E pg-boss test schemas (17 tables each, timestamped names) that leaked into prod.
DROP SCHEMA IF EXISTS pgboss_e2e_1776896218_18476 CASCADE;
DROP SCHEMA IF EXISTS pgboss_e2e_1776897527_19099 CASCADE;
DROP SCHEMA IF EXISTS pgboss_e2e_1776897830_19295 CASCADE;
DROP SCHEMA IF EXISTS pgboss_e2e_1776898027_19503 CASCADE;

-- SECURITY DEFINER functions exposed as anon/authenticated RPC that should be backend-only.
-- get_quintile_performance: only called by backend validation.service.ts via service_role.
REVOKE EXECUTE ON FUNCTION public.get_quintile_performance(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_quintile_performance(text,text,text) TO service_role;
-- NOTE: PostGIS st_estimatedextent(text,...) x3 is also flagged (anon-executable SECURITY DEFINER) but is
-- owned by supabase_admin and belongs to the postgis extension; its PUBLIC EXECUTE was granted BY
-- supabase_admin, so a REVOKE as postgres is a silent no-op. It is platform-managed and accepted (the
-- function only returns a spatial-extent estimate from table stats; no data/PII exposure). Left as-is.

-- public_bucket_allows_listing: org-logos had a TO-public policy permitting clients to list all files.
-- Scope to service_role; the public bucket still serves logos by direct URL.
DROP POLICY IF EXISTS "Service role can manage org logos" ON storage.objects;
CREATE POLICY "Service role can manage org logos" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'org-logos') WITH CHECK (bucket_id = 'org-logos');

-- INTENTIONALLY LEFT (documented, not bugs):
--  * extension_in_public (postgis, vector, pg_trgm, fuzzystrmatch, pg_jsonschema): moving is high-risk
--    (esp. postgis) and commonly accepted on Supabase.
--  * rls_policy_always_true on user_events / user_sessions (anon/authenticated INSERT, WITH CHECK true):
--    deliberate append-only anonymous analytics capture.
--  * get_shared_analysis / get_shared_analysis_branding (anon-executable SECURITY DEFINER): the public
--    share-link feature reads a shared row by token and must bypass the owner's RLS, so this is by design.
