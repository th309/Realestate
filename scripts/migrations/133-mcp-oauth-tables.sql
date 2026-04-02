-- Migration 133: MCP OAuth 2.1 tables
-- Supports dynamic client registration, authorization codes, and access/refresh tokens

-- 1. Dynamic client registration (RFC 7591)
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text UNIQUE NOT NULL,
  client_name text NOT NULL DEFAULT '',
  redirect_uris text[] NOT NULL DEFAULT '{}',
  grant_types text[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token'],
  response_types text[] NOT NULL DEFAULT ARRAY['code'],
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mcp_oauth_clients ENABLE ROW LEVEL SECURITY;

-- 2. Authorization codes (10-minute TTL, single-use)
CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  client_id text NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  scope text NOT NULL DEFAULT 'mcp',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean NOT NULL DEFAULT false
);

ALTER TABLE mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_mcp_oauth_codes_code ON mcp_oauth_codes(code);
CREATE INDEX idx_mcp_oauth_codes_expires ON mcp_oauth_codes(expires_at);

-- 3. Access + refresh tokens
CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text UNIQUE NOT NULL,
  refresh_token text UNIQUE NOT NULL,
  client_id text NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'mcp',
  access_expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  refresh_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_mcp_oauth_tokens_access ON mcp_oauth_tokens(access_token);
CREATE INDEX idx_mcp_oauth_tokens_refresh ON mcp_oauth_tokens(refresh_token);
CREATE INDEX idx_mcp_oauth_tokens_user ON mcp_oauth_tokens(user_id);

-- 4. Permissions (service_role only)
GRANT ALL ON mcp_oauth_clients TO service_role;
GRANT ALL ON mcp_oauth_codes TO service_role;
GRANT ALL ON mcp_oauth_tokens TO service_role;

-- 5. Cleanup job (requires pg_cron extension)
-- Run daily to purge expired codes and fully-expired tokens
SELECT cron.schedule(
  'mcp-oauth-cleanup',
  '0 3 * * *',  -- 3 AM UTC daily
  $$
    DELETE FROM mcp_oauth_codes WHERE expires_at < now();
    DELETE FROM mcp_oauth_tokens WHERE access_expires_at < now() AND refresh_expires_at < now();
  $$
);
