-- Migration: extend_ai_model_config_shadow_columns
--
-- Adds shadow_provider, shadow_model, shadow_sample_rate to ai_model_config.
-- When shadow_provider IS NULL, shadow mode is disabled for that purpose.
-- Pairs with ai-shadow.service.ts which gates on these values per request.

ALTER TABLE ai_model_config
  ADD COLUMN IF NOT EXISTS shadow_provider    TEXT,
  ADD COLUMN IF NOT EXISTS shadow_model       TEXT,
  ADD COLUMN IF NOT EXISTS shadow_sample_rate NUMERIC(3,2) DEFAULT 0 CHECK (shadow_sample_rate BETWEEN 0 AND 1);
