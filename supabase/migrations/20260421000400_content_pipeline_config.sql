-- Content pipeline config tables (tts_voices, format_templates, style_references)
-- Part of P1 foundation per docs/content-pipeline/implementation-plan.md Task 1.6

-- tts_voices: voice presets per provider
CREATE TABLE IF NOT EXISTS tts_voices (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_voice_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  audience_tag TEXT NOT NULL DEFAULT 'short_form',
  sample_url TEXT,
  cost_per_1k_chars NUMERIC NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE tts_voices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON tts_voices;
CREATE POLICY service_role_all ON tts_voices FOR ALL USING (true);
GRANT ALL ON tts_voices TO service_role;
GRANT ALL ON tts_voices TO authenticated;

-- format_templates: per-format defaults
CREATE TABLE IF NOT EXISTS format_templates (
  format TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  audience TEXT NOT NULL,
  aspect TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  default_approval_mode TEXT NOT NULL DEFAULT 'review',
  default_tts_provider TEXT NOT NULL DEFAULT 'edge',
  default_tts_voice_id TEXT REFERENCES tts_voices(id),
  script_prompt_path TEXT NOT NULL,
  default_platforms TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE format_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON format_templates;
CREATE POLICY service_role_all ON format_templates FOR ALL USING (true);
GRANT ALL ON format_templates TO service_role;
GRANT ALL ON format_templates TO authenticated;

-- style_references: uploaded or URL-ingested references (P2+ populates)
CREATE TABLE IF NOT EXISTS style_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  source_url TEXT,
  preview_strip_url TEXT,
  extracted_attributes JSONB NOT NULL DEFAULT '{}',
  vision_cost_usd NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_style_references_user ON style_references (user_id);
ALTER TABLE style_references ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON style_references;
CREATE POLICY service_role_all ON style_references FOR ALL USING (true);
DROP POLICY IF EXISTS user_read_own ON style_references;
CREATE POLICY user_read_own ON style_references FOR SELECT USING (auth.uid() = user_id);
GRANT ALL ON style_references TO service_role;
GRANT ALL ON style_references TO authenticated;
