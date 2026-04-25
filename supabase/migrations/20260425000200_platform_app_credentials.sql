-- Per-platform OAuth APP credentials (client_id + client_secret).
-- Distinct from platform_credentials (per-account refresh tokens) — these
-- are the developer-app credentials that let PropertyIQ start an OAuth
-- flow at all. Storing them in DB lets admins enter them via the UI
-- without Railway env-var trips.

CREATE TABLE IF NOT EXISTS platform_app_credentials (
  platform TEXT PRIMARY KEY,
  client_id_enc TEXT NOT NULL,    -- AES-encrypted via CredentialCrypto
  client_secret_enc TEXT NOT NULL,-- AES-encrypted via CredentialCrypto
  client_id_last4 TEXT,           -- plaintext last 4 chars for UI confirmation only
  notes TEXT,                     -- optional operator notes
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE platform_app_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON platform_app_credentials;
CREATE POLICY service_role_all ON platform_app_credentials FOR ALL USING (true);
GRANT ALL ON platform_app_credentials TO service_role;
GRANT ALL ON platform_app_credentials TO authenticated;
