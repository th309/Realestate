-- 20260503000300_redfin_migration_tables.sql
CREATE TABLE IF NOT EXISTS redfin_migration_metro (
  cbsa_code TEXT NOT NULL,
  region_name TEXT,
  period_date DATE NOT NULL,
  net_inflow NUMERIC,
  inflow_share_pct NUMERIC,
  outflow_share_pct NUMERIC,
  total_users INT,
  PRIMARY KEY (cbsa_code, period_date)
);
CREATE INDEX IF NOT EXISTS idx_redfin_migration_metro_period
  ON redfin_migration_metro(period_date DESC);

CREATE TABLE IF NOT EXISTS redfin_migration_flows_metro (
  origin_cbsa TEXT NOT NULL,
  destination_cbsa TEXT NOT NULL,
  period_date DATE NOT NULL,
  share_pct NUMERIC,
  net_searches INT,
  PRIMARY KEY (origin_cbsa, destination_cbsa, period_date)
);
CREATE INDEX IF NOT EXISTS idx_redfin_flows_dest
  ON redfin_migration_flows_metro(destination_cbsa, period_date DESC);
CREATE INDEX IF NOT EXISTS idx_redfin_flows_origin
  ON redfin_migration_flows_metro(origin_cbsa, period_date DESC);

GRANT ALL ON redfin_migration_metro TO service_role, authenticated;
GRANT ALL ON redfin_migration_flows_metro TO service_role, authenticated;
