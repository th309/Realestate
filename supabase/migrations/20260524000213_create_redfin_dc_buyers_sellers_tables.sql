-- Redfin Data Center: buyers_and_sellers (balance of power) dashboard (add-only).
-- country / census_region / metro (top-50). property_type is part of the row
-- identity (PK); balance_of_power is a stored label. metro PK adds region_name.
DO $$
DECLARE
  spec TEXT;
  tbl TEXT;
  pk TEXT;
BEGIN
  FOREACH spec IN ARRAY ARRAY[
    'country|(period_end, region_id, property_type)',
    'census_region|(period_end, region_id, property_type)',
    'metro|(period_end, region_id, region_name, property_type)'
  ] LOOP
    tbl := 'redfin_dc_buyers_sellers_' || split_part(spec, '|', 1);
    pk := split_part(spec, '|', 2);
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %s (
        region_id   TEXT NOT NULL,
        region_name TEXT,
        period_begin DATE,
        period_end   DATE NOT NULL,
        frequency    TEXT,
        last_updated DATE,
        property_type TEXT NOT NULL,
        balance_of_power TEXT,
        buyers NUMERIC,
        buyers_yoy NUMERIC,
        sellers NUMERIC,
        sellers_yoy NUMERIC,
        buyer_seller_ratio NUMERIC,
        buyer_seller_ratio_yoy NUMERIC,
        seller_buyer_difference NUMERIC,
        seller_buyer_difference_yoy NUMERIC,
        PRIMARY KEY %s
      );
      CREATE INDEX IF NOT EXISTS idx_%s_period ON %s (period_end DESC);
      GRANT ALL ON %s TO service_role, authenticated;
    $f$, tbl, pk, tbl, tbl, tbl);
  END LOOP;
END $$;
