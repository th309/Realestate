-- Branding RPC for the public analyzer share page + PDF render.
--
-- Resolves the share token to the owner's organization branding so the
-- unauthenticated /shared/analysis/[token] page (and the Puppeteer-driven
-- ?print=1 render) can show org logo, accent color, footer disclaimer, etc.
-- The owner's user_id is intentionally never returned. Same PII contract as
-- get_shared_analysis: the token is the capability.

CREATE OR REPLACE FUNCTION get_shared_analysis_branding(p_token TEXT)
RETURNS TABLE (
  logo_url            TEXT,
  org_name            TEXT,
  accent_color        TEXT,
  phone               TEXT,
  website_url         TEXT,
  support_email       TEXT,
  report_disclaimer   TEXT,
  report_header_text  TEXT,
  report_footer_text  TEXT,
  powered_by_visible  BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.logo_url,
    o.name           AS org_name,
    o.accent_color,
    o.phone,
    o.website_url,
    o.support_email,
    o.report_disclaimer,
    o.report_header_text,
    o.report_footer_text,
    o.powered_by_visible
  FROM deal_analyses d
  JOIN user_profiles u ON u.id = d.owner_id
  JOIN organizations o ON o.id = u.organization_id
  WHERE d.share_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_shared_analysis_branding(TEXT) TO anon, authenticated, service_role;
