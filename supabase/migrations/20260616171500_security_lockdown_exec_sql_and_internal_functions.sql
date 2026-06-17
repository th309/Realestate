-- Security remediation (2026-06-16): lock down SECURITY DEFINER functions that were
-- EXECUTE-able by PUBLIC (i.e. anon via the publishable key) through PostgREST /rpc.
-- Applied live to prod via execute_sql on 2026-06-16; this file tracks it in git.
--
-- #1 CRITICAL: public.exec_sql(text) runs arbitrary SQL as its owner (postgres) and was
--    callable unauthenticated via /rest/v1/rpc/exec_sql  ->  full database compromise.
--    Backend scripts/API routes call it with the sb_secret key (service_role), so they keep working.
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Internal / trigger functions that should never be RPC-callable by anon/authenticated.
-- (Trigger invocation is unaffected by EXECUTE grants; only the public /rpc surface is removed.)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_profiles_broadcast_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_propertyiq_quintile_summary() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_propertyiq_quintile_summary() TO service_role;
