-- Content pipeline core tables
-- Part of P1 foundation per docs/content-pipeline/implementation-plan.md Task 1.3

-- content_runs: one row per operator-initiated or auto-ideation-triggered run
CREATE TABLE IF NOT EXISTS content_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  audience TEXT NOT NULL,
  market_query TEXT NOT NULL,
  resolved_geo JSONB,
  approval_mode TEXT NOT NULL DEFAULT 'review',
  tts_provider TEXT NOT NULL DEFAULT 'edge',
  tts_voice_id TEXT,
  script_llm_model TEXT,
  hook_variants JSONB,
  style_reference_id UUID,
  selected_platforms TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  status_reason TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'manual',
  triggered_by_user UUID,
  idempotency_key TEXT UNIQUE,
  costs JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_runs_status_created ON content_runs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_content_runs_format_audience ON content_runs (format, audience);
CREATE INDEX IF NOT EXISTS idx_content_runs_created_desc ON content_runs (created_at DESC);
ALTER TABLE content_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON content_runs;
CREATE POLICY service_role_all ON content_runs FOR ALL USING (true);
GRANT ALL ON content_runs TO service_role;
GRANT ALL ON content_runs TO authenticated;

-- content_assets: all files produced during a run (script, audio, video, thumbnails, captions)
CREATE TABLE IF NOT EXISTS content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES content_runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  variant TEXT,
  storage_url TEXT NOT NULL,
  content_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_assets_run_kind ON content_assets (run_id, kind);
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_assets_hash ON content_assets (content_hash) WHERE content_hash IS NOT NULL;
ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON content_assets;
CREATE POLICY service_role_all ON content_assets FOR ALL USING (true);
GRANT ALL ON content_assets TO service_role;
GRANT ALL ON content_assets TO authenticated;

-- content_run_events: append-only audit log per run
CREATE TABLE IF NOT EXISTS content_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES content_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_run_events_run_created ON content_run_events (run_id, created_at);
ALTER TABLE content_run_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON content_run_events;
CREATE POLICY service_role_all ON content_run_events FOR ALL USING (true);
GRANT ALL ON content_run_events TO service_role;
GRANT ALL ON content_run_events TO authenticated;

-- content_run_gates: per-gate invocation result (Gate A data verifier, Gate B brand-voice linter)
CREATE TABLE IF NOT EXISTS content_run_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES content_runs(id) ON DELETE CASCADE,
  gate TEXT NOT NULL,
  result TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  llm_judge_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_run_gates_run ON content_run_gates (run_id);
ALTER TABLE content_run_gates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON content_run_gates;
CREATE POLICY service_role_all ON content_run_gates FOR ALL USING (true);
GRANT ALL ON content_run_gates TO service_role;
GRANT ALL ON content_run_gates TO authenticated;
