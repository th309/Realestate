-- Migration: ai_model_config_drop_unused_columns_seed_missing_purposes
--
-- 1. Drop max_tokens_override and prompt_version (no code reads either).
-- 2. Seed report_follow_up and research_clarifying — both are called in code
--    (report-follow-up.service.ts, research-brief.service.ts) but were never
--    seeded, so they silently rode the env-var fallback config.

ALTER TABLE ai_model_config
  DROP COLUMN IF EXISTS max_tokens_override,
  DROP COLUMN IF EXISTS prompt_version;

INSERT INTO ai_model_config (purpose, label, provider, model, temperature) VALUES
  ('report_follow_up',   'Report Follow-up (30-day market change summary)', 'deepseek', 'deepseek-v4-pro', 0.30),
  ('research_clarifying','Research Brief - Clarifying Questions',           'deepseek', 'deepseek-v4-pro', 0.30)
ON CONFLICT (purpose) DO NOTHING;
