-- ============================================================================
-- Add source tracking to newsletter_signups
-- Migration: 136
--
-- Adds a `source` column to newsletter_signups to track where each subscriber
-- signed up (homepage, city-page, exit-intent). Nullable so existing rows
-- are unaffected.
-- ============================================================================

BEGIN;

ALTER TABLE newsletter_signups
ADD COLUMN IF NOT EXISTS source TEXT;

-- Index for analytics queries segmenting by source
CREATE INDEX IF NOT EXISTS idx_newsletter_signups_source
  ON newsletter_signups(source)
  WHERE source IS NOT NULL;

COMMIT;
