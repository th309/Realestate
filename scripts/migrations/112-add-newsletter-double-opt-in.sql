-- ============================================================================
-- Newsletter Double Opt-In
-- Migration: 112
--
-- Adds confirmation_token, confirmed flag, and confirmed_at timestamp to
-- the newsletter_signups table to support email double opt-in flow.
-- After signing up, users receive a confirmation email. Subscription is
-- only active once they click the confirmation link.
-- ============================================================================

BEGIN;

ALTER TABLE newsletter_signups
ADD COLUMN IF NOT EXISTS confirmation_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Index for fast token lookup during confirmation
CREATE INDEX IF NOT EXISTS idx_newsletter_confirmation_token
  ON newsletter_signups(confirmation_token)
  WHERE confirmed = false;

COMMIT;
