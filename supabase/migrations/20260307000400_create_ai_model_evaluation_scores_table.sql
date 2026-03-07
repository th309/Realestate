-- Migration: create_ai_model_evaluation_scores_table
-- Stores manual quality scores for AI model evaluation test runs.

CREATE TABLE IF NOT EXISTS ai_model_evaluation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  report_type TEXT,
  geography TEXT,
  depth_score INTEGER CHECK (depth_score BETWEEN 1 AND 5),
  accuracy_score INTEGER CHECK (accuracy_score BETWEEN 1 AND 5),
  writing_score INTEGER CHECK (writing_score BETWEEN 1 AND 5),
  actionability_score INTEGER CHECK (actionability_score BETWEEN 1 AND 5),
  notes TEXT,
  report_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_test_run_score UNIQUE (test_run_id)
);

CREATE INDEX idx_eval_scores_model ON ai_model_evaluation_scores (model);

-- Grant permissions
GRANT ALL ON ai_model_evaluation_scores TO service_role;
GRANT ALL ON ai_model_evaluation_scores TO authenticated;

-- RLS
ALTER TABLE ai_model_evaluation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON ai_model_evaluation_scores
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_eval_scores_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER eval_scores_updated
  BEFORE UPDATE ON ai_model_evaluation_scores
  FOR EACH ROW EXECUTE FUNCTION update_eval_scores_timestamp();
