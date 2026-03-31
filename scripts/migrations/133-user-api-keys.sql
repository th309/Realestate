-- Migration 133: Personal API keys for Pro users
-- Mirrors organization_api_keys but keyed on user_id

CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  rate_limit_rpm INT DEFAULT 60,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_api_keys_hash
  ON user_api_keys(key_hash)
  WHERE is_active = true;

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own api keys" ON user_api_keys
  FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON user_api_keys TO service_role;
GRANT ALL ON user_api_keys TO authenticated;
