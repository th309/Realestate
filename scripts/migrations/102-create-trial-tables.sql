-- ============================================================================
-- Trial Management Tables
-- Migration: 102
-- ============================================================================

BEGIN;

-- Global trial configuration
CREATE TABLE IF NOT EXISTS trial_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN DEFAULT false,
  duration_days INTEGER DEFAULT 14,
  trial_tier VARCHAR(50) DEFAULT 'pro',
  show_banner BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Ensure only one config row
INSERT INTO trial_config (is_enabled, duration_days, trial_tier, show_banner)
VALUES (false, 14, 'pro', true)
ON CONFLICT DO NOTHING;

-- User trials
CREATE TABLE IF NOT EXISTS user_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  tier VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  converted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_trials_user ON user_trials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trials_expires ON user_trials(expires_at) WHERE converted_at IS NULL AND cancelled_at IS NULL;

-- Grant permissions
GRANT SELECT, UPDATE ON trial_config TO service_role;
GRANT SELECT, INSERT, UPDATE ON user_trials TO service_role;

COMMIT;
