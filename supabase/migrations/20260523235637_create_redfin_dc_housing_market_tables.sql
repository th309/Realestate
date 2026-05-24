-- Redfin Data Center: housing_market dashboard (add-only). Also feeds the
-- months_of_supply computed fallback (active_listings / homes_sold) in Phase 9.
-- country/state/county/zip: PK (period_end, region_id). metro: PK incl region_name.
DO $$
DECLARE
  geo TEXT;
BEGIN
  FOREACH geo IN ARRAY ARRAY['country', 'state', 'county', 'zip'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS redfin_dc_housing_market_%s (
        region_id   TEXT NOT NULL,
        region_name TEXT,
        period_begin DATE,
        period_end   DATE NOT NULL,
        frequency    TEXT,
        last_updated DATE,
        homes_sold NUMERIC,
        homes_sold_mom NUMERIC,
        homes_sold_yoy NUMERIC,
        median_sale_price NUMERIC,
        median_sale_price_mom NUMERIC,
        median_sale_price_yoy NUMERIC,
        median_days_on_market NUMERIC,
        median_days_on_market_mom NUMERIC,
        median_days_on_market_yoy NUMERIC,
        average_sale_to_list_ratio NUMERIC,
        average_sale_to_list_ratio_mom NUMERIC,
        average_sale_to_list_ratio_yoy NUMERIC,
        share_sold_above_original_list NUMERIC,
        share_sold_above_original_list_mom NUMERIC,
        share_sold_above_original_list_yoy NUMERIC,
        new_listings NUMERIC,
        new_listings_mom NUMERIC,
        new_listings_yoy NUMERIC,
        active_listings NUMERIC,
        active_listings_mom NUMERIC,
        active_listings_yoy NUMERIC,
        pending_sales NUMERIC,
        pending_sales_mom NUMERIC,
        pending_sales_yoy NUMERIC,
        PRIMARY KEY (period_end, region_id)
      );
      CREATE INDEX IF NOT EXISTS idx_redfin_dc_housing_market_%s_period
        ON redfin_dc_housing_market_%s (period_end DESC);
      GRANT ALL ON redfin_dc_housing_market_%s TO service_role, authenticated;
    $f$, geo, geo, geo, geo);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS redfin_dc_housing_market_metro (
  region_id   TEXT NOT NULL,
  region_name TEXT NOT NULL,
  period_begin DATE,
  period_end   DATE NOT NULL,
  frequency    TEXT,
  last_updated DATE,
  homes_sold NUMERIC,
  homes_sold_mom NUMERIC,
  homes_sold_yoy NUMERIC,
  median_sale_price NUMERIC,
  median_sale_price_mom NUMERIC,
  median_sale_price_yoy NUMERIC,
  median_days_on_market NUMERIC,
  median_days_on_market_mom NUMERIC,
  median_days_on_market_yoy NUMERIC,
  average_sale_to_list_ratio NUMERIC,
  average_sale_to_list_ratio_mom NUMERIC,
  average_sale_to_list_ratio_yoy NUMERIC,
  share_sold_above_original_list NUMERIC,
  share_sold_above_original_list_mom NUMERIC,
  share_sold_above_original_list_yoy NUMERIC,
  new_listings NUMERIC,
  new_listings_mom NUMERIC,
  new_listings_yoy NUMERIC,
  active_listings NUMERIC,
  active_listings_mom NUMERIC,
  active_listings_yoy NUMERIC,
  pending_sales NUMERIC,
  pending_sales_mom NUMERIC,
  pending_sales_yoy NUMERIC,
  PRIMARY KEY (period_end, region_id, region_name)
);
CREATE INDEX IF NOT EXISTS idx_redfin_dc_housing_market_metro_period
  ON redfin_dc_housing_market_metro (period_end DESC);
GRANT ALL ON redfin_dc_housing_market_metro TO service_role, authenticated;
