-- Migration: create_ai_model_config_table

CREATE TABLE IF NOT EXISTS ai_model_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose TEXT NOT NULL,
  label TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'deepseek',
  model TEXT NOT NULL,
  base_url TEXT,
  temperature NUMERIC(3,2) DEFAULT 0.70,
  max_tokens_override INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_active_purpose UNIQUE (purpose)
);

-- Seed with current defaults
INSERT INTO ai_model_config (purpose, label, provider, model, temperature) VALUES
  ('report_narrative',    'Report Narratives (HomeReady/InvestorEdge/Custom)', 'deepseek', 'deepseek-reasoner', 0.70),
  ('report_outline',      'Report Outline Pass',                               'deepseek', 'deepseek-reasoner', 0.50),
  ('custom_report',       'Custom Report Generation',                          'deepseek', 'deepseek-reasoner', 0.70),
  ('research_agent',      'Research Brief - Data Gathering',                   'deepseek', 'deepseek-chat', 0.30),
  ('research_narrative',  'Research Brief - Narrative Writing',                'deepseek', 'deepseek-reasoner', 0.70),
  ('news_scout',          'News Scouting (Web Search)',                        'anthropic', 'claude-sonnet-4-6', 0.30),
  ('conversation',        'Report Conversation Follow-up',                     'deepseek', 'deepseek-chat', 0.70)
ON CONFLICT (purpose) DO NOTHING;

-- RLS: only service role can read/write (admin access via backend API)
ALTER TABLE ai_model_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON ai_model_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_model_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_model_config_updated
  BEFORE UPDATE ON ai_model_config
  FOR EACH ROW EXECUTE FUNCTION update_ai_model_config_timestamp();
