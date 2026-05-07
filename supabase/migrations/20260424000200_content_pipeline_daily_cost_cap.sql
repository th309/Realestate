-- [P5] Daily USD cost caps + per-format daily run caps

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

