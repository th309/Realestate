-- ============================================================================
-- Newsletter Signups Table
-- Migration: 111
--
-- Stores newsletter subscription email addresses.
-- The API route upserts on email to handle duplicate submissions gracefully.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS newsletter_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  source VARCHAR(100) DEFAULT 'website',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on email (used by upsert onConflict)
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_signups_email
  ON newsletter_signups(email);

-- Index for listing active subscribers
CREATE INDEX IF NOT EXISTS idx_newsletter_signups_active
  ON newsletter_signups(subscribed_at DESC) WHERE unsubscribed_at IS NULL;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON newsletter_signups TO service_role;

COMMIT;
