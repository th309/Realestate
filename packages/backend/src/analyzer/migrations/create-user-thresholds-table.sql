-- Migration: Create user_thresholds table
-- Purpose: Per-user, per-strategy grading rubric overrides for the deal analyzer.
-- One row per (user_id, strategy). When no row exists, gradeDeal() falls back
-- to the strategy's default preset (BUY_AND_HOLD_DEFAULTS et al.).
--
-- The thresholds JSONB column stores the full UserThresholds shape:
--   { cashOnCash: {A,B,C,D,direction}, dscr: {…}, cashFlowPerDoor: {…},
--     capRate: {…}, breakEvenOccupancy: {…},
--     weights: { cashOnCash, dscr, cashFlowPerDoor, capRate, breakEvenOccupancy } }
-- Per-DTO validation enforces ordering invariants + weights summing to 100.

CREATE TABLE IF NOT EXISTS user_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy TEXT NOT NULL CHECK (strategy IN ('BUY_AND_HOLD','FIX_AND_FLIP','BRRRR')),
  thresholds JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, strategy)
);

CREATE INDEX IF NOT EXISTS idx_user_thresholds_user ON user_thresholds(user_id);

-- Per-table updated_at trigger (no moddatetime extension in this DB).
CREATE OR REPLACE FUNCTION update_user_thresholds_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_thresholds_updated ON user_thresholds;
CREATE TRIGGER user_thresholds_updated
  BEFORE UPDATE ON user_thresholds
  FOR EACH ROW EXECUTE FUNCTION update_user_thresholds_timestamp();

-- RLS: backend uses service_role (bypasses RLS); these policies protect
-- direct frontend/anon Supabase client access.
ALTER TABLE user_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own thresholds"
  ON user_thresholds FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- GRANTs — required for sb_secret_/service_role to function on new tables.
GRANT ALL ON user_thresholds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_thresholds TO authenticated;
