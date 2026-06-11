-- Redfin Data Center: delistings_relistings dashboard (add-only).
-- country/state/county/zip: PK (period_end, region_id). metro: PK incl region_name.
DO $$
DECLARE
  geo TEXT;
BEGIN
  FOREACH geo IN ARRAY ARRAY['country', 'state', 'county', 'zip'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS redfin_dc_delistings_relistings_%s (
        region_id   TEXT NOT NULL,
        region_name TEXT,
        period_begin DATE,
        period_end   DATE NOT NULL,
        frequency    TEXT,
        last_updated DATE,
        total_delistings NUMERIC,
        total_delistings_mom NUMERIC,
        total_delistings_yoy NUMERIC,
        total_relistings NUMERIC,
        total_relistings_mom NUMERIC,
        total_relistings_yoy NUMERIC,
        share_of_listings_delisted NUMERIC,
        share_of_listings_delisted_mom NUMERIC,
        share_of_listings_delisted_yoy NUMERIC,
        share_of_listings_relisted NUMERIC,
        share_of_listings_relisted_mom NUMERIC,
        share_of_listings_relisted_yoy NUMERIC,
        PRIMARY KEY (period_end, region_id)
      );
      CREATE INDEX IF NOT EXISTS idx_redfin_dc_delistings_relistings_%s_period
        ON redfin_dc_delistings_relistings_%s (period_end DESC);
      GRANT ALL ON redfin_dc_delistings_relistings_%s TO service_role, authenticated;
    $f$, geo, geo, geo, geo);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS redfin_dc_delistings_relistings_metro (
  region_id   TEXT NOT NULL,
  region_name TEXT NOT NULL,
  period_begin DATE,
  period_end   DATE NOT NULL,
  frequency    TEXT,
  last_updated DATE,
  total_delistings NUMERIC,
  total_delistings_mom NUMERIC,
  total_delistings_yoy NUMERIC,
  total_relistings NUMERIC,
  total_relistings_mom NUMERIC,
  total_relistings_yoy NUMERIC,
  share_of_listings_delisted NUMERIC,
  share_of_listings_delisted_mom NUMERIC,
  share_of_listings_delisted_yoy NUMERIC,
  share_of_listings_relisted NUMERIC,
  share_of_listings_relisted_mom NUMERIC,
  share_of_listings_relisted_yoy NUMERIC,
  PRIMARY KEY (period_end, region_id, region_name)
);
CREATE INDEX IF NOT EXISTS idx_redfin_dc_delistings_relistings_metro_period
  ON redfin_dc_delistings_relistings_metro (period_end DESC);
GRANT ALL ON redfin_dc_delistings_relistings_metro TO service_role, authenticated;
