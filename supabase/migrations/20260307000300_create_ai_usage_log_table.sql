-- Migration: create_ai_usage_log_table
-- Lightweight usage tracking for AI model evaluation and cost analysis.

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id TEXT,
  purpose TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost_usd NUMERIC(10,6),
  duration_ms INTEGER,
  report_id UUID,
  section_id TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_ai_usage_log_test_run ON ai_usage_log (test_run_id) WHERE test_run_id IS NOT NULL;
CREATE INDEX idx_ai_usage_log_purpose ON ai_usage_log (purpose);
CREATE INDEX idx_ai_usage_log_model ON ai_usage_log (model);
CREATE INDEX idx_ai_usage_log_report ON ai_usage_log (report_id) WHERE report_id IS NOT NULL;
CREATE INDEX idx_ai_usage_log_created ON ai_usage_log (created_at);

-- Grant permissions
GRANT ALL ON ai_usage_log TO service_role;
GRANT SELECT ON ai_usage_log TO authenticated;

-- RLS (service_role writes, authenticated can read for admin dashboards)
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON ai_usage_log
  FOR ALL
  USING (true)
  WITH CHECK (true);
