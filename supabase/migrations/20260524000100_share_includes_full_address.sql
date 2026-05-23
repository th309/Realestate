-- Add address_full to the public share RPC return.
--
-- Original migration stripped address_full as a "PII protection" measure, but
-- the actual use case is a real-estate agent sending an analysis PDF to their
-- client — the client is the prospective buyer, they already know the address.
-- Hiding it from the cover page just makes the report look broken.
--
-- Recipients still don't see owner_id, lat, or lon.

DROP FUNCTION IF EXISTS get_shared_analysis(TEXT);

CREATE OR REPLACE FUNCTION get_shared_analysis(p_token TEXT)
RETURNS TABLE (
  id              UUID,
  label           TEXT,
  address_full    TEXT,
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
  SELECT id, label, address_full, address_city, address_state, address_zip,
         input_snapshot, result_snapshot, market_context, ai_verdict, created_at
  FROM deal_analyses
  WHERE share_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_shared_analysis(TEXT) TO anon, authenticated, service_role;
