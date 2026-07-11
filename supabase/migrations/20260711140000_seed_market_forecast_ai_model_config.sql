-- Seed the ai_model_config row for the market_forecast insight purpose.
-- Without a row, AiConfigResolver silently falls back to env-default config —
-- a documented failure mode (see reference: AiConfigResolver silent env
-- fallback). Matches market_overview (the long-form sibling): deepseek-v4-pro.

INSERT INTO ai_model_config (purpose, label, provider, model, temperature, is_active, notes)
SELECT
  'market_forecast',
  'SEO Market Forecast (long-form, /forecast pages)',
  'deepseek',
  'deepseek-v4-pro',
  0.70,
  true,
  'Added 2026-07-11: forecast-angle narrative for /forecast SEO pages (momentum outlook, honesty rules — no price predictions). Batch-generated monthly post-rescore for metros.'
WHERE NOT EXISTS (
  SELECT 1 FROM ai_model_config WHERE purpose = 'market_forecast'
);
