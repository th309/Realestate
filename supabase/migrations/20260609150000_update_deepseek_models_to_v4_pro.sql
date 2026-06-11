-- Migration: update_deepseek_models_to_v4_pro
--
-- Collapse every live DeepSeek model reference in ai_model_config onto the
-- single deepseek-v4-pro model. Replaces the legacy deepseek-chat (V3.2),
-- deepseek-reasoner (V3.2-Speciale), and deepseek-v4-flash IDs that were
-- seeded by 20260307000100 and 20260514120000.
--
-- Pairs with code changes that point all DeepSeek defaults/catalogs at
-- deepseek-v4-pro (PROVIDER_PRESETS, service AI_MODEL fallbacks, content
-- pipeline DEFAULT_DEEPSEEK_SCRIPT_MODEL, admin model catalog).
--
-- WHERE clause scopes to provider = 'deepseek' so any rows an admin has
-- already routed to another provider (e.g. the analyzer purposes moved to
-- claude-opus-4-7) are left untouched. Safe to re-run.
--
-- Not editing the applied seed migrations -- mutating history would diverge
-- fresh DBs from prod. Fresh DBs briefly land on the seeded legacy IDs then
-- immediately upgrade to deepseek-v4-pro when this migration runs.
--
-- Cost note: deepseek-v4-pro is $0.435/1M input (cache miss) and $0.87/1M
-- output. Cheaper output than legacy deepseek-chat ($1.10) and reasoner
-- ($2.19); slightly higher input than chat ($0.27).

UPDATE ai_model_config
SET model = 'deepseek-v4-pro',
    updated_at = now()
WHERE provider = 'deepseek'
  AND model IN ('deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash');

-- Collapse any shadow-mode comparisons pointed at legacy DeepSeek IDs too.
UPDATE ai_model_config
SET shadow_model = 'deepseek-v4-pro',
    updated_at = now()
WHERE shadow_provider = 'deepseek'
  AND shadow_model IN ('deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash');

-- market_insights stores the generating model per row; refresh its column
-- default so future inserts that omit model land on v4-pro. IF EXISTS guards
-- environments where the table has not been created yet.
ALTER TABLE IF EXISTS market_insights
  ALTER COLUMN model SET DEFAULT 'deepseek-v4-pro';
