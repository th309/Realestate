-- Redfin Data Center: price_drops dashboard (new CSV format, add-only).
-- country/state/county/zip: PK (period_end, region_id).
-- metro: PK (period_end, region_id, region_name) — Redfin metro DIVISIONS (e.g.
--   LA + Anaheim) legitimately share a parent CBSA, so region_name keeps both.
DO $$
DECLARE
  geo TEXT;
BEGIN
  FOREACH geo IN ARRAY ARRAY['country', 'state', 'county', 'zip'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS redfin_dc_price_drops_%s (
        region_id   TEXT NOT NULL,
        region_name TEXT,
        period_begin DATE,
        period_end   DATE NOT NULL,
        frequency    TEXT,
        last_updated DATE,
        price_drops NUMERIC,
        price_drops_mom NUMERIC,
        price_drops_yoy NUMERIC,
        average_size_of_price_drop NUMERIC,
        average_size_of_price_drop_mom NUMERIC,
        average_size_of_price_drop_yoy NUMERIC,
        percent_active_with_price_drops NUMERIC,
        percent_active_with_price_drops_mom NUMERIC,
        percent_active_with_price_drops_yoy NUMERIC,
        PRIMARY KEY (period_end, region_id)
      );
      CREATE INDEX IF NOT EXISTS idx_redfin_dc_price_drops_%s_period
        ON redfin_dc_price_drops_%s (period_end DESC);
      GRANT ALL ON redfin_dc_price_drops_%s TO service_role, authenticated;
    $f$, geo, geo, geo, geo);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS redfin_dc_price_drops_metro (
  region_id   TEXT NOT NULL,
  region_name TEXT NOT NULL,
  period_begin DATE,
  period_end   DATE NOT NULL,
  frequency    TEXT,
  last_updated DATE,
  price_drops NUMERIC,
  price_drops_mom NUMERIC,
  price_drops_yoy NUMERIC,
  average_size_of_price_drop NUMERIC,
  average_size_of_price_drop_mom NUMERIC,
  average_size_of_price_drop_yoy NUMERIC,
  percent_active_with_price_drops NUMERIC,
  percent_active_with_price_drops_mom NUMERIC,
  percent_active_with_price_drops_yoy NUMERIC,
  PRIMARY KEY (period_end, region_id, region_name)
);
CREATE INDEX IF NOT EXISTS idx_redfin_dc_price_drops_metro_period
  ON redfin_dc_price_drops_metro (period_end DESC);
GRANT ALL ON redfin_dc_price_drops_metro TO service_role, authenticated;
