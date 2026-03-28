-- Migration 130: Add draft token and embed config support for Embed Builder wizard
-- The wizard creates a draft token for live preview, then finalizes it on completion.

BEGIN;

ALTER TABLE organization_embed_tokens
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS embed_config JSONB;

-- Partial index: exclude drafts from normal list queries
CREATE INDEX IF NOT EXISTS idx_embed_tokens_active_non_draft
  ON organization_embed_tokens(organization_id)
  WHERE is_active = true AND is_draft = false;

COMMIT;
