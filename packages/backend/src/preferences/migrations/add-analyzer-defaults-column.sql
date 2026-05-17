-- Migration: add analyzer_defaults JSONB to user_preferences
-- Purpose: persist per-user analyzer form defaults (vacancy %, maintenance %,
-- capex %, pm %, rent growth %, appreciation %, hold years, closing cost %)
-- that pre-fill the deal analyzer on next visit. JSONB so the schema can
-- evolve without per-knob ALTERs.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS analyzer_defaults JSONB;

-- Existing "Users can manage own preferences" RLS policy covers the new
-- column. Existing table grants cover it too.
