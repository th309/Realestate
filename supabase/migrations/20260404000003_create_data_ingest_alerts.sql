-- Migration: Create data_ingest_alerts table
-- Purpose: Backing table for DataAlertsService (packages/backend/src/health/data-alerts.service.ts)
-- Note: acknowledged_by / resolved_by are TEXT (not UUID FK) because the service
--       writes 'system' as a fallback value alongside real user IDs.

CREATE TABLE IF NOT EXISTS data_ingest_alerts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type        TEXT        NOT NULL,
  severity          TEXT        NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  source_name       TEXT,
  pipeline_name     TEXT,
  title             TEXT        NOT NULL,
  message           TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  metadata          JSONB,
  resolution_notes  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at   TIMESTAMPTZ,
  acknowledged_by   TEXT,
  resolved_at       TIMESTAMPTZ,
  resolved_by       TEXT
);

CREATE INDEX idx_ingest_alerts_status   ON data_ingest_alerts(status);
CREATE INDEX idx_ingest_alerts_severity ON data_ingest_alerts(severity);
CREATE INDEX idx_ingest_alerts_created  ON data_ingest_alerts(created_at DESC);

-- RLS: any authenticated user can read; service_role handles writes
ALTER TABLE data_ingest_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_alerts"
  ON data_ingest_alerts
  FOR SELECT
  USING (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE ON TABLE data_ingest_alerts TO service_role;
