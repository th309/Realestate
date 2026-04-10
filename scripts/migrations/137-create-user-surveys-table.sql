-- ============================================================================
-- Create user_surveys table
-- Migration: 137
--
-- Stores NPS and future survey responses. Survey links contain a signed
-- token so users can respond without being logged in.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS user_surveys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  survey_type TEXT NOT NULL,
  score       INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One response per user per survey type
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_surveys_user_type
  ON user_surveys(user_id, survey_type);

CREATE INDEX IF NOT EXISTS idx_user_surveys_survey_type
  ON user_surveys(survey_type);

-- Row Level Security — only admin-level access (no user self-access needed)
ALTER TABLE user_surveys ENABLE ROW LEVEL SECURITY;

-- Service-role bypass (backend writes via admin client)
CREATE POLICY "Service role full access" ON user_surveys
  FOR ALL USING (auth.role() = 'service_role');

COMMIT;
