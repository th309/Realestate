-- supabase/migrations/20260423000200_platform_credentials.sql
-- Encrypted OAuth refresh tokens for content-pipeline platform publishers.
-- One active row per platform; re-connects upsert. Soft-deletes via
-- disconnected_at for audit history.

CREATE TABLE IF NOT EXISTS platform_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  account_label text,
  refresh_token_enc text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_credentials_platform_active_uniq
  ON platform_credentials (platform)
  WHERE disconnected_at IS NULL;

CREATE INDEX IF NOT EXISTS platform_credentials_platform_idx
  ON platform_credentials (platform);

GRANT SELECT, INSERT, UPDATE, DELETE ON platform_credentials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_credentials TO authenticated;

COMMENT ON TABLE platform_credentials IS
  'Encrypted OAuth refresh tokens for content-pipeline platform publishers. One active row per platform; re-connects upsert. Soft-deletes via disconnected_at for audit history.';
COMMENT ON COLUMN platform_credentials.refresh_token_enc IS
  'CredentialCrypto.encrypt(refresh_token) output — AES-256-GCM with PLATFORM_CREDENTIALS_ENCRYPTION_KEY.';
COMMENT ON COLUMN platform_credentials.account_label IS
  'Human-readable account identifier. For YouTube: channel customUrl (e.g. @propertyIQ_app).';
