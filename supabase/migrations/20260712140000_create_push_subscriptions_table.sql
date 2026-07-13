-- Web Push subscriptions: one row per browser/device subscription endpoint.
-- Endpoint is globally unique — re-subscribing (e.g. after clearing storage or
-- switching accounts on the same device) upserts on endpoint and reassigns
-- user_id, which is why there's no separate (user_id, endpoint) unique key.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint         TEXT NOT NULL UNIQUE,
  p256dh           TEXT NOT NULL,
  auth             TEXT NOT NULL,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_owner_select ON push_subscriptions;
CREATE POLICY push_subscriptions_owner_select ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_owner_insert ON push_subscriptions;
CREATE POLICY push_subscriptions_owner_insert ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_owner_update ON push_subscriptions;
CREATE POLICY push_subscriptions_owner_update ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_owner_delete ON push_subscriptions;
CREATE POLICY push_subscriptions_owner_delete ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- GRANTs required for new Supabase API keys (sb_secret_ / sb_publishable_).
-- Without these, even service_role JWTs hit permission-denied. See MEMORY.md
-- "Supabase Key Architecture (March 2026)".
GRANT ALL ON push_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;
