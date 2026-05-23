-- Migration: seed_analyzer_ai_purposes_anthropic
--
-- Ensures the two analyzer AI purposes exist in ai_model_config seeded to
-- Anthropic Claude Sonnet 4.6, matching the other report purposes
-- (report_narrative, report_outline, research_agent, research_narrative).
--
-- Supersedes the earlier 20260514120000_seed_analyzer_ai_purposes.sql, which
-- never ran on prod: it was committed 2026-05-15 with a backdated 2026-05-14
-- file timestamp, after migration 20260514211612 had already been applied, so
-- the Supabase runner silently skipped it as "in the past." The analyzer was
-- then running for 9 days on env-var fallback (AI_PROVIDER + AI_MODEL +
-- AI_BASE_URL), which masqueraded as Anthropic in logs while actually routing
-- to a DeepSeek base_url -- 400-ing all narrative calls in prod on 2026-05-23.
--
-- ON CONFLICT DO NOTHING is intentional: prod already has these rows from a
-- manual INSERT made during incident triage on 2026-05-23, and admins may
-- have tuned per-purpose values via the admin UI. This migration's job is to
-- guarantee the rows EXIST in any fresh DB; it does not overwrite tuning.
--
-- Provider/model choices follow the established pattern: leave base_url NULL
-- so PROVIDER_PRESETS supplies the correct host. Setting base_url is what
-- caused the 2026-05-23 outage; never set it unless you know exactly why.

INSERT INTO ai_model_config (purpose, label, provider, model, base_url, temperature, is_active, prompt_version) VALUES
  ('analyzer_section_annotation', 'Analyzer Section Annotations (batched + per-section)', 'anthropic', 'claude-sonnet-4-6', NULL, 0.70, true, 'v1'),
  ('analyzer_header_verdict',     'Analyzer Header Verdict (SSE stream)',                 'anthropic', 'claude-sonnet-4-6', NULL, 0.70, true, 'v1')
ON CONFLICT (purpose) DO NOTHING;
