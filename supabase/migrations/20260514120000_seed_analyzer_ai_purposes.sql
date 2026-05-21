-- Migration: seed_analyzer_ai_purposes
-- Adds two analyzer purposes used by AiInsightsService and the refactored
-- streamAiVerdict path. Both default to deepseek-chat for cost; admins can
-- route via the ai_model_config admin UI later.

INSERT INTO ai_model_config (purpose, label, provider, model, temperature) VALUES
  ('analyzer_header_verdict',     'Analyzer Header Verdict (streaming)',     'deepseek', 'deepseek-chat', 0.30),
  ('analyzer_section_annotation', 'Analyzer Per-Section Annotation',         'deepseek', 'deepseek-chat', 0.40)
ON CONFLICT (purpose) DO NOTHING;
