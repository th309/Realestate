-- Migration: Add ToS acceptance tracking to user_profiles
-- This column records when a user accepted the Terms of Service during signup.
-- Nullable: existing users will have NULL (no re-acceptance required).

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles.tos_accepted_at IS
  'Timestamp when user accepted the Terms of Service during signup';
