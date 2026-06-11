-- Migration: create_ai_shadow_config_table
--
-- Singleton table (id=1) holding global shadow runtime config:
--   - enabled: master kill switch
--   - daily_usd_ceiling: auto-disable when crossed (tracked in Redis)
-- Backend reads this at most once per 30s via AiShadowService cache.

CREATE TABLE IF NOT EXISTS ai_shadow_config (
  id                INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled           BOOLEAN NOT NULL DEFAULT false,
  daily_usd_ceiling NUMERIC(8,2) NOT NULL DEFAULT 5.00,
  updated_at        TIMESTAMPTZ DEFAULT now()
);

INSERT INTO ai_shadow_config (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT ALL    ON ai_shadow_config TO service_role;
GRANT SELECT ON ai_shadow_config TO authenticated;

ALTER TABLE ai_shadow_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON ai_shadow_config
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_ai_shadow_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_shadow_config_updated
  BEFORE UPDATE ON ai_shadow_config
  FOR EACH ROW EXECUTE FUNCTION update_ai_shadow_config_timestamp();
