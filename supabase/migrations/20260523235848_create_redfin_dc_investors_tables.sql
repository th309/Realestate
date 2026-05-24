-- Redfin Data Center: investors dashboard (add-only). Metro-only coverage
-- (country + ~39 metros) plus a national by_category breakdown. No state/county/zip.
CREATE TABLE IF NOT EXISTS redfin_dc_investors_country (
  region_id   TEXT NOT NULL,
  region_name TEXT,
  period_begin DATE,
  period_end   DATE NOT NULL,
  frequency    TEXT,
  last_updated DATE,
  investor_home_purchases NUMERIC,
  investor_home_purchases_yoy NUMERIC,
  investor_market_share NUMERIC,
  share_of_investor_home_purchases NUMERIC,
  PRIMARY KEY (period_end, region_id)
);
CREATE INDEX IF NOT EXISTS idx_redfin_dc_investors_country_period
  ON redfin_dc_investors_country (period_end DESC);
GRANT ALL ON redfin_dc_investors_country TO service_role, authenticated;

CREATE TABLE IF NOT EXISTS redfin_dc_investors_metro (
  region_id   TEXT NOT NULL,
  region_name TEXT NOT NULL,
  period_begin DATE,
  period_end   DATE NOT NULL,
  frequency    TEXT,
  last_updated DATE,
  investor_home_purchases NUMERIC,
  investor_home_purchases_yoy NUMERIC,
  investor_market_share NUMERIC,
  share_of_investor_home_purchases NUMERIC,
  PRIMARY KEY (period_end, region_id, region_name)
);
CREATE INDEX IF NOT EXISTS idx_redfin_dc_investors_metro_period
  ON redfin_dc_investors_metro (period_end DESC);
GRANT ALL ON redfin_dc_investors_metro TO service_role, authenticated;

-- National breakdown by category (price tier / property type). noGeo: region_id='US'.
CREATE TABLE IF NOT EXISTS redfin_dc_investors_by_category (
  region_id   TEXT NOT NULL,
  region_name TEXT,
  period_begin DATE,
  period_end   DATE NOT NULL,
  frequency    TEXT,
  last_updated DATE,
  category_type TEXT NOT NULL,
  category      TEXT NOT NULL,
  property_type TEXT,
  investor_home_purchases NUMERIC,
  investor_home_purchases_yoy NUMERIC,
  investor_market_share NUMERIC,
  share_of_investor_home_purchases NUMERIC,
  PRIMARY KEY (period_end, category_type, category)
);
CREATE INDEX IF NOT EXISTS idx_redfin_dc_investors_by_category_period
  ON redfin_dc_investors_by_category (period_end DESC);
GRANT ALL ON redfin_dc_investors_by_category TO service_role, authenticated;
