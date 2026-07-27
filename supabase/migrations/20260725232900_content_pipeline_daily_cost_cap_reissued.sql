-- Re-issue of 20260424000200_content_pipeline_daily_cost_cap.sql, which was
-- silently skipped by the migration runner: its version (20260424000200) was
-- below the ledger max when it landed, and out-of-order migrations are not
-- applied. Applied to the live DB on 2026-07-25 as version 20260725232900.
-- Symptom fixed: /admin/content-pipeline dashboard 500 (getCostCapStatus threw
-- "relation cost_cap_daily does not exist"). Content identical to the original.

CREATE TABLE IF NOT EXISTS cost_cap_daily (
  date DATE PRIMARY KEY,
  usd_spent NUMERIC NOT NULL DEFAULT 0,
  usd_cap NUMERIC NOT NULL,
  breach_at TIMESTAMPTZ
);

ALTER TABLE cost_cap_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON cost_cap_daily FOR ALL USING (true);
GRANT ALL ON cost_cap_daily TO service_role;
GRANT ALL ON cost_cap_daily TO authenticated;

CREATE TABLE IF NOT EXISTS format_daily_run_counts (
  format TEXT NOT NULL,
  date DATE NOT NULL,
  run_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (format, date)
);

ALTER TABLE format_daily_run_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON format_daily_run_counts FOR ALL USING (true);
GRANT ALL ON format_daily_run_counts TO service_role;
GRANT ALL ON format_daily_run_counts TO authenticated;
