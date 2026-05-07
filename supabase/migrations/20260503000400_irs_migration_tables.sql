-- 20260503000400_irs_migration_tables.sql
-- origin_fips reserves: '00000' = non-migrants, '99999' = foreign
CREATE TABLE IF NOT EXISTS irs_county_migration_flows (
  origin_fips TEXT NOT NULL,
  destination_fips TEXT NOT NULL,
  tax_year INT NOT NULL,
  num_returns INT NOT NULL,
  num_exemptions INT NOT NULL,
  agi_thousands BIGINT,
  PRIMARY KEY (origin_fips, destination_fips, tax_year)
);
CREATE INDEX IF NOT EXISTS idx_irs_flows_dest
  ON irs_county_migration_flows(destination_fips, tax_year DESC);
CREATE INDEX IF NOT EXISTS idx_irs_flows_origin
  ON irs_county_migration_flows(origin_fips, tax_year DESC);

CREATE TABLE IF NOT EXISTS irs_migration_county_aggregates (
  county_fips TEXT NOT NULL,
  tax_year INT NOT NULL,
  in_returns INT,
  out_returns INT,
  net_returns INT,
  in_exemptions INT,
  out_exemptions INT,
  in_agi_thousands BIGINT,
  out_agi_thousands BIGINT,
  in_avg_agi NUMERIC,
  out_avg_agi NUMERIC,
  PRIMARY KEY (county_fips, tax_year)
);

GRANT ALL ON irs_county_migration_flows TO service_role, authenticated;
GRANT ALL ON irs_migration_county_aggregates TO service_role, authenticated;
