-- Add batch_id to content_runs so batch-created runs can be grouped/filtered
-- back at the dashboard. Most runs are single (NULL batch_id), so the index
-- is partial to keep it small.

ALTER TABLE content_runs
  ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_content_runs_batch_id
  ON content_runs(batch_id)
  WHERE batch_id IS NOT NULL;

GRANT ALL ON content_runs TO service_role;
GRANT ALL ON content_runs TO authenticated;
