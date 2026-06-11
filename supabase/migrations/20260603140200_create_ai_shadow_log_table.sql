-- Migration: create_ai_shadow_log_table
--
-- Stores paired (primary, shadow) AI outputs for side-by-side A/B comparison.
-- One row per request that ran shadow. Manual rating fields (preferred,
-- reviewer_note, reviewed_by, reviewed_at) are filled later via the
-- /admin/ai-models/shadow page.

CREATE TABLE IF NOT EXISTS ai_shadow_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          UUID NOT NULL,
  purpose             TEXT NOT NULL,

  primary_provider    TEXT NOT NULL,
  primary_model       TEXT NOT NULL,
  primary_output      TEXT NOT NULL,
  primary_duration_ms INTEGER,
  primary_cost_usd    NUMERIC(10,6),
  primary_tokens_in   INTEGER,
  primary_tokens_out  INTEGER,

  shadow_provider     TEXT NOT NULL,
  shadow_model        TEXT NOT NULL,
  shadow_output       TEXT,
  shadow_duration_ms  INTEGER,
  shadow_cost_usd     NUMERIC(10,6),
  shadow_tokens_in    INTEGER,
  shadow_tokens_out   INTEGER,
  shadow_error        TEXT,

  preferred           TEXT CHECK (preferred IN ('primary','shadow','tie')),
  reviewer_note       TEXT,
  reviewed_by         UUID,
  reviewed_at         TIMESTAMPTZ,

  input_preview       TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_shadow_log_purpose_unreviewed
  ON ai_shadow_log (purpose, created_at DESC)
  WHERE preferred IS NULL;

CREATE INDEX idx_shadow_log_request_id
  ON ai_shadow_log (request_id);

GRANT ALL                  ON ai_shadow_log TO service_role;
GRANT SELECT, UPDATE       ON ai_shadow_log TO authenticated;

ALTER TABLE ai_shadow_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON ai_shadow_log
  FOR ALL USING (true) WITH CHECK (true);
