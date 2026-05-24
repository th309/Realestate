-- Redfin Data Center: rhpi (Redfin Home Price Index) dashboard (add-only).
-- Metro-only coverage (country + top-50 metros). No state/county/zip.
CREATE TABLE IF NOT EXISTS redfin_dc_rhpi_country (
  region_id TEXT NOT NULL, region_name TEXT, period_begin DATE, period_end DATE NOT NULL,
  frequency TEXT, last_updated DATE,
  redfin_home_price_index NUMERIC, redfin_home_price_index_mom NUMERIC, redfin_home_price_index_yoy NUMERIC,
  PRIMARY KEY (period_end, region_id)
);
CREATE INDEX IF NOT EXISTS idx_redfin_dc_rhpi_country_period ON redfin_dc_rhpi_country (period_end DESC);
GRANT ALL ON redfin_dc_rhpi_country TO service_role, authenticated;

CREATE TABLE IF NOT EXISTS redfin_dc_rhpi_metro (
  region_id TEXT NOT NULL, region_name TEXT NOT NULL, period_begin DATE, period_end DATE NOT NULL,
  frequency TEXT, last_updated DATE,
  redfin_home_price_index NUMERIC, redfin_home_price_index_mom NUMERIC, redfin_home_price_index_yoy NUMERIC,
  PRIMARY KEY (period_end, region_id, region_name)
);
CREATE INDEX IF NOT EXISTS idx_redfin_dc_rhpi_metro_period ON redfin_dc_rhpi_metro (period_end DESC);
GRANT ALL ON redfin_dc_rhpi_metro TO service_role, authenticated;
