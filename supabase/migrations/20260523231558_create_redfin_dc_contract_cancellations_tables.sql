-- Redfin Data Center: contract_cancellations dashboard (add-only).
-- country/state/county/zip: PK (period_end, region_id). metro: PK incl region_name
-- (Redfin metro divisions share a parent CBSA).
DO $$
DECLARE
  geo TEXT;
BEGIN
  FOREACH geo IN ARRAY ARRAY['country', 'state', 'county', 'zip'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS redfin_dc_contract_cancellations_%s (
        region_id   TEXT NOT NULL,
        region_name TEXT,
        period_begin DATE,
        period_end   DATE NOT NULL,
        frequency    TEXT,
        last_updated DATE,
        home_purchase_cancellations NUMERIC,
        home_purchase_cancellations_mom NUMERIC,
        home_purchase_cancellations_yoy NUMERIC,
        percent_of_pending_sales NUMERIC,
        percent_of_pending_sales_mom NUMERIC,
        percent_of_pending_sales_yoy NUMERIC,
        PRIMARY KEY (period_end, region_id)
      );
      CREATE INDEX IF NOT EXISTS idx_redfin_dc_contract_cancellations_%s_period
        ON redfin_dc_contract_cancellations_%s (period_end DESC);
      GRANT ALL ON redfin_dc_contract_cancellations_%s TO service_role, authenticated;
    $f$, geo, geo, geo, geo);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS redfin_dc_contract_cancellations_metro (
  region_id   TEXT NOT NULL,
  region_name TEXT NOT NULL,
  period_begin DATE,
  period_end   DATE NOT NULL,
  frequency    TEXT,
  last_updated DATE,
  home_purchase_cancellations NUMERIC,
  home_purchase_cancellations_mom NUMERIC,
  home_purchase_cancellations_yoy NUMERIC,
  percent_of_pending_sales NUMERIC,
  percent_of_pending_sales_mom NUMERIC,
  percent_of_pending_sales_yoy NUMERIC,
  PRIMARY KEY (period_end, region_id, region_name)
);
CREATE INDEX IF NOT EXISTS idx_redfin_dc_contract_cancellations_metro_period
  ON redfin_dc_contract_cancellations_metro (period_end DESC);
GRANT ALL ON redfin_dc_contract_cancellations_metro TO service_role, authenticated;
