-- Content pipeline attribution tables (magnets, bindings, signup attributions, deliveries)
-- Part of P1 foundation per docs/content-pipeline/implementation-plan.md Task 1.5

-- lead_magnet_definitions: catalog of available magnets, runtime-editable via admin UI
CREATE TABLE IF NOT EXISTS lead_magnet_definitions (
  kind TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  audience TEXT NOT NULL,
  template_path TEXT NOT NULL,
  data_method TEXT NOT NULL,
  data_default_args JSONB NOT NULL DEFAULT '{}',
  email_template_key TEXT NOT NULL,
  landing_page_path TEXT NOT NULL,
  cover_image_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE lead_magnet_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON lead_magnet_definitions;
CREATE POLICY service_role_all ON lead_magnet_definitions FOR ALL USING (true);
GRANT ALL ON lead_magnet_definitions TO service_role;
GRANT ALL ON lead_magnet_definitions TO authenticated;

-- format_magnet_bindings: which magnet each format delivers; weight supports A/B
CREATE TABLE IF NOT EXISTS format_magnet_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  magnet_kind TEXT NOT NULL REFERENCES lead_magnet_definitions(kind) ON DELETE CASCADE,
  cta_text TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (format, magnet_kind)
);
CREATE INDEX IF NOT EXISTS idx_format_magnet_bindings_format ON format_magnet_bindings (format) WHERE enabled = true;
ALTER TABLE format_magnet_bindings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON format_magnet_bindings;
CREATE POLICY service_role_all ON format_magnet_bindings FOR ALL USING (true);
GRANT ALL ON format_magnet_bindings TO service_role;
GRANT ALL ON format_magnet_bindings TO authenticated;

-- signup_attributions: the money table linking new accounts to runs
CREATE TABLE IF NOT EXISTS signup_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attributed_run_id UUID NOT NULL REFERENCES content_runs(id) ON DELETE SET NULL,
  attributed_slug TEXT NOT NULL,
  attributed_platform TEXT NOT NULL,
  first_touch_at TIMESTAMPTZ NOT NULL,
  signup_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tier_at_signup TEXT NOT NULL DEFAULT 'free'
);
CREATE INDEX IF NOT EXISTS idx_signup_attributions_run ON signup_attributions (attributed_run_id);
CREATE INDEX IF NOT EXISTS idx_signup_attributions_user ON signup_attributions (user_id);
ALTER TABLE signup_attributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON signup_attributions;
CREATE POLICY service_role_all ON signup_attributions FOR ALL USING (true);
DROP POLICY IF EXISTS user_read_own ON signup_attributions;
CREATE POLICY user_read_own ON signup_attributions FOR SELECT USING (auth.uid() = user_id);
GRANT ALL ON signup_attributions TO service_role;
GRANT ALL ON signup_attributions TO authenticated;

-- lead_magnet_deliveries: one row per signup that received a magnet
CREATE TABLE IF NOT EXISTS lead_magnet_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  magnet_kind TEXT NOT NULL REFERENCES lead_magnet_definitions(kind),
  resolved_geo JSONB NOT NULL,
  pdf_asset_id UUID REFERENCES content_assets(id) ON DELETE SET NULL,
  dashboard_url TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  emailed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lead_magnet_deliveries_user ON lead_magnet_deliveries (user_id);
ALTER TABLE lead_magnet_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON lead_magnet_deliveries;
CREATE POLICY service_role_all ON lead_magnet_deliveries FOR ALL USING (true);
DROP POLICY IF EXISTS user_read_own ON lead_magnet_deliveries;
CREATE POLICY user_read_own ON lead_magnet_deliveries FOR SELECT USING (auth.uid() = user_id);
GRANT ALL ON lead_magnet_deliveries TO service_role;
GRANT ALL ON lead_magnet_deliveries TO authenticated;
