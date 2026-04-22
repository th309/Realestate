-- Migration: add_trial_columns_to_user_profiles
-- Purpose: Add the columns the Apr 12 onboarding spec assumed but never migrated.
-- Backend code in onboarding/engagement/behavioral-trigger services currently references
-- these columns. Without them, trial lifecycle is broken. This unblocks Section 5 of the
-- activation funnel remediation spec.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS trial_started_at         timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at            timestamptz,
  ADD COLUMN IF NOT EXISTS trial_expired_emitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS free_report_credits      integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_market        jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_checklist     jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dismissed_beacons        jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS usage_stats              jsonb DEFAULT '{}'::jsonb;

-- Index for the trial expiration cron query
CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_ends_at
  ON public.user_profiles (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

-- Partial index for the cron's exact WHERE clause (expired but not yet emitted)
CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_expiration_queue
  ON public.user_profiles (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL AND trial_expired_emitted_at IS NULL;

GRANT ALL ON public.user_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
