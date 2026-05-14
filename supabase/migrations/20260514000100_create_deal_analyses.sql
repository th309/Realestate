-- Deal Analyzer: persisted deal analyses with public share-by-token support.
-- RLS restricts row access to the owner; public sharing routed through a
-- SECURITY DEFINER function that strips PII (owner_id, full address).

CREATE TABLE IF NOT EXISTS deal_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token     TEXT NOT NULL UNIQUE,
  label           TEXT,
  address_full    TEXT,
  address_city    TEXT NOT NULL,
  address_state   TEXT NOT NULL,
  address_zip     TEXT,
  lat             NUMERIC(9, 6),
  lon             NUMERIC(9, 6),
  input_snapshot  JSONB NOT NULL,
  result_snapshot JSONB NOT NULL,
  market_context  JSONB,
  ai_verdict      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_analyses_owner ON deal_analyses (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_analyses_share_token ON deal_analyses (share_token);

ALTER TABLE deal_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_analyses_owner_select ON deal_analyses;
CREATE POLICY deal_analyses_owner_select ON deal_analyses
  FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS deal_analyses_owner_insert ON deal_analyses;
CREATE POLICY deal_analyses_owner_insert ON deal_analyses
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS deal_analyses_owner_update ON deal_analyses;
CREATE POLICY deal_analyses_owner_update ON deal_analyses
  FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS deal_analyses_owner_delete ON deal_analyses;
CREATE POLICY deal_analyses_owner_delete ON deal_analyses
  FOR DELETE USING (auth.uid() = owner_id);

-- GRANTs required for new Supabase API keys (sb_secret_ / sb_publishable_).
-- Without these, even service_role JWTs hit permission-denied. See MEMORY.md
-- "Supabase Key Architecture (March 2026)".
GRANT ALL ON deal_analyses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON deal_analyses TO authenticated;

-- Public share access via SECURITY DEFINER function. Returns only fields safe
-- to expose publicly: no owner_id, no full street address, no lat/lon.
CREATE OR REPLACE FUNCTION get_shared_analysis(p_token TEXT)
RETURNS TABLE (
  id              UUID,
  label           TEXT,
  address_city    TEXT,
  address_state   TEXT,
  address_zip     TEXT,
  input_snapshot  JSONB,
  result_snapshot JSONB,
  market_context  JSONB,
  ai_verdict      JSONB,
  created_at      TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, label, address_city, address_state, address_zip,
         input_snapshot, result_snapshot, market_context, ai_verdict, created_at
  FROM deal_analyses
  WHERE share_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_shared_analysis(TEXT) TO anon, authenticated, service_role;
