CREATE TABLE IF NOT EXISTS observability_queue_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name TEXT NOT NULL,
  depth INTEGER NOT NULL,
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_samples_queue_time
  ON observability_queue_samples (queue_name, sampled_at DESC);

ALTER TABLE observability_queue_samples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON observability_queue_samples;
CREATE POLICY service_role_all ON observability_queue_samples FOR ALL USING (true);
GRANT ALL ON observability_queue_samples TO service_role;

