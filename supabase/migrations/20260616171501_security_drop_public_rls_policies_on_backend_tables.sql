-- Security remediation (2026-06-16): these backend-only tables had a permissive RLS policy
-- (service_role_all / service_role_full_access) created WITHOUT a `TO` clause, so it defaulted
-- to `TO public` with USING(true) -> every role (incl. anon/authenticated) had full read/write.
-- Confirmed live exposure: anon read 11 rows of ai_model_config via the publishable key.
--
-- service_role bypasses RLS (rolbypassrls=true), so dropping these policies does NOT affect the
-- backend (it connects with the sb_secret key = service_role). anon/authenticated fall through to
-- RLS default-deny. Any user-scoped policies (user_read_own, users_own_alerts) are left intact.
-- Applied live to prod via execute_sql on 2026-06-16; this file tracks it in git.
DROP POLICY IF EXISTS service_role_full_access ON public.ai_model_config;
DROP POLICY IF EXISTS service_role_full_access ON public.ai_model_evaluation_scores;
DROP POLICY IF EXISTS service_role_full_access ON public.ai_shadow_config;
DROP POLICY IF EXISTS service_role_full_access ON public.ai_shadow_log;
DROP POLICY IF EXISTS service_role_full_access ON public.ai_usage_log;
DROP POLICY IF EXISTS service_role_full_access ON public.report_follow_up_alerts;
DROP POLICY IF EXISTS service_role_all ON public.archetype_clusters;
DROP POLICY IF EXISTS service_role_all ON public.archetype_refresh_runs;
DROP POLICY IF EXISTS service_role_all ON public.content_assets;
DROP POLICY IF EXISTS service_role_all ON public.content_metrics;
DROP POLICY IF EXISTS service_role_all ON public.content_run_events;
DROP POLICY IF EXISTS service_role_all ON public.content_run_gates;
DROP POLICY IF EXISTS service_role_all ON public.content_runs;
DROP POLICY IF EXISTS service_role_all ON public.format_magnet_bindings;
DROP POLICY IF EXISTS service_role_all ON public.format_templates;
DROP POLICY IF EXISTS service_role_all ON public.lead_magnet_definitions;
DROP POLICY IF EXISTS service_role_all ON public.lead_magnet_deliveries;
DROP POLICY IF EXISTS service_role_all ON public.platform_app_credentials;
DROP POLICY IF EXISTS service_role_all ON public.platform_posts;
DROP POLICY IF EXISTS service_role_all ON public.script_archetypes;
DROP POLICY IF EXISTS service_role_all ON public.short_links;
DROP POLICY IF EXISTS service_role_all ON public.signup_attributions;
DROP POLICY IF EXISTS service_role_all ON public.style_references;
DROP POLICY IF EXISTS service_role_all ON public.transcript_cache;
DROP POLICY IF EXISTS service_role_all ON public.tts_voices;
