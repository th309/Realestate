-- Seed ai_model_config rows for the content-feed generation purposes, routed to
-- DeepSeek by default. Without a row, AiConfigResolver silently falls back to
-- env-default config (documented failure mode: "AiConfigResolver silent env
-- fallback"). Mirrors the market_forecast/market_overview seeds: deepseek-v4-pro.
--
-- Purposes (see AI_PURPOSES in packages/backend/src/ai-provider/ai-provider.types.ts):
--   post_generation  — generate social post copy for the proactive feed
--   tone_adaptation  — re-voice existing copy for a different platform/audience
--   brand_analysis   — analyze a brand/site to derive a voice + approved-copy profile

INSERT INTO ai_model_config (purpose, label, provider, model, temperature, is_active, notes)
SELECT 'post_generation',
       'Content feed post generation (LinkedIn/Facebook/carousel/video copy)',
       'deepseek',
       'deepseek-v4-pro',
       0.80,
       true,
       'Added 2026-07-25 (Phase 2 content feed): DeepSeek-first per content-pipeline convention. Higher temperature for varied post copy; output run through Gate B brand-voice linter.'
WHERE NOT EXISTS (SELECT 1 FROM ai_model_config WHERE purpose = 'post_generation');

INSERT INTO ai_model_config (purpose, label, provider, model, temperature, is_active, notes)
SELECT 'tone_adaptation',
       'Content feed tone adaptation (re-voice copy per platform/audience)',
       'deepseek',
       'deepseek-v4-pro',
       0.70,
       true,
       'Added 2026-07-25 (Phase 2 content feed): DeepSeek-first. Lower temperature to stay faithful to source copy while adapting tone.'
WHERE NOT EXISTS (SELECT 1 FROM ai_model_config WHERE purpose = 'tone_adaptation');

INSERT INTO ai_model_config (purpose, label, provider, model, temperature, is_active, notes)
SELECT 'brand_analysis',
       'Content feed brand analysis (derive voice + approved-copy profile)',
       'deepseek',
       'deepseek-v4-pro',
       0.40,
       true,
       'Added 2026-07-25 (Phase 2 content feed): DeepSeek-first. Low temperature for consistent structured brand extraction.'
WHERE NOT EXISTS (SELECT 1 FROM ai_model_config WHERE purpose = 'brand_analysis');
