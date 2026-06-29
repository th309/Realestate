-- Seed the `report_narrative_comparison` AI purpose. Comparison reports route
-- ALL their narrative sections here — the cross-market synthesis AND each
-- market's full per-market report — so they can use a faster/cheaper model
-- (deepseek-v4-flash) than single-market reports, which keep `report_narrative`
-- (deepseek-v4-pro). A comparison fans out many concurrent narrative calls
-- (synthesis + one full narrative per market, generated in parallel), so the
-- flash model keeps wall-clock and cost down without changing single-market
-- report quality. Without this row the purpose silently rides the env-var
-- fallback config (AI_PROVIDER/AI_MODEL) — see AiConfigResolver.
INSERT INTO ai_model_config (purpose, label, provider, model, temperature) VALUES
  ('report_narrative_comparison', 'Report Narratives — Comparison (synthesis + per-market)', 'deepseek', 'deepseek-v4-flash', 0.70)
ON CONFLICT (purpose) DO NOTHING;
