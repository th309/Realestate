-- Migration: seed_custom_report_purpose
--
-- Seeds the `custom_report` purpose. It is in the AI_PURPOSES registry and was
-- in the original 20260307000100 seed, but is absent from the live table — so a
-- `custom_report` call would silently ride the env-var fallback config. Seeding
-- it makes the purpose explicit and admin-tunable, consistent with the other
-- report purposes (deepseek-v4-pro, temp 0.70 like report_narrative).

INSERT INTO ai_model_config (purpose, label, provider, model, temperature) VALUES
  ('custom_report', 'Custom Report Generation', 'deepseek', 'deepseek-v4-pro', 0.70)
ON CONFLICT (purpose) DO NOTHING;
