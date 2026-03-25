-- Migration 119: Organization slug redirects for 30-day redirect after rename

BEGIN;

CREATE TABLE IF NOT EXISTS organization_slug_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  old_slug TEXT NOT NULL,
  new_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Fast lookup by old slug (most recent first)
CREATE INDEX IF NOT EXISTS idx_slug_redirects_lookup
  ON organization_slug_redirects(old_slug, expires_at DESC);

-- Index for cleanup of expired redirects
CREATE INDEX IF NOT EXISTS idx_slug_redirects_expires
  ON organization_slug_redirects(expires_at);

-- Grants
GRANT ALL ON organization_slug_redirects TO service_role;
GRANT SELECT ON organization_slug_redirects TO authenticated;

COMMIT;
