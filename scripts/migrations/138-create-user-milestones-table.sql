-- ============================================================================
-- Create user_milestones table
-- Migration: 138
--
-- Append-only log of first-time user achievements. Used to show celebratory
-- toasts on first meaningful actions and avoid repeat notifications.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS user_milestones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_key  TEXT NOT NULL,
  achieved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each user can only achieve a milestone once
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_milestones_user_key
  ON user_milestones(user_id, milestone_key);

CREATE INDEX IF NOT EXISTS idx_user_milestones_user_id
  ON user_milestones(user_id);

ALTER TABLE user_milestones ENABLE ROW LEVEL SECURITY;

-- Users can read their own milestones
CREATE POLICY "Users read own milestones" ON user_milestones
  FOR SELECT USING (auth.uid() = user_id);

-- Service role for backend writes
CREATE POLICY "Service role full access" ON user_milestones
  FOR ALL USING (auth.role() = 'service_role');

COMMIT;
