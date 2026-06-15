-- Populate screener_snapshot.home_value (Zillow ZHVI) and .rent (Zillow ZORI),
-- which the original refresh fn (20260615111802) left NULL. Adds two latest-per-
-- region CTEs over zillow_{metro,county,zip} keyed exactly like the snapshot's
-- region_id (metro=cbsa_code, county=fips_code, zip=region_name), LEFT JOINed so
-- regions without ZHVI/ZORI stay NULL rather than dropping out.
--
-- CREATE OR REPLACE resets per-function settings to their defaults, so the
-- statement_timeout relaxation from 20260615133937 is folded inline here (the
-- two extra DISTINCT ON passes over zillow history make the 600s budget matter).
CREATE OR REPLACE FUNCTION refresh_screener_snapshot()
RETURNS integer
LANGUAGE plpgsql
SET statement_timeout = '600s'
AS $$
DECLARE
  n integer;
BEGIN
  TRUNCATE screener_snapshot;

  INSERT INTO screener_snapshot (
    geo_level, region_id, region_name, state_code,
    score, grade, confidence, median_price, home_value, rent,
    cap_rate, gross_yield, rent_to_price_ratio, grm, months_of_supply, overvalued_pct,
    as_of, refreshed_at
  )
  WITH latest_scores AS (
    SELECT DISTINCT ON (geography, location_id)
      geography, location_id, location_name, score, grade, confidence, median_price, score_date
    FROM propertyiq_scores
    WHERE score_type = 'propertyiq'
      AND geography IN ('metro','county','zip')
      AND score_date >= (CURRENT_DATE - INTERVAL '3 months')
    ORDER BY geography, location_id, score_date DESC
  ),
  latest_cm AS (
    SELECT DISTINCT ON (geography_type, geography_id)
      geography_type, geography_id,
      cap_rate, gross_yield, rent_to_price_ratio, grm, months_of_supply, overvalued_pct
    FROM calculated_metrics
    WHERE geography_type IN ('metro','county','zip')
      AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
    ORDER BY geography_type, geography_id, period_date DESC
  ),
  zip_state AS (
    SELECT DISTINCT ON (region_name) region_name, state_code
    FROM zillow_zip
    WHERE metric_name = 'zhvi' AND state_code IS NOT NULL
      AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
    ORDER BY region_name, period_date DESC
  ),
  -- Latest ZHVI (home value) per region: one row per geo level + join key.
  latest_home_value AS (
    ( SELECT DISTINCT ON (cbsa_code) 'metro'::text AS geo_level, cbsa_code::text AS join_id, value AS home_value
        FROM zillow_metro
        WHERE metric_name = 'zhvi' AND cbsa_code IS NOT NULL
          AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
        ORDER BY cbsa_code, period_date DESC )
    UNION ALL
    ( SELECT DISTINCT ON (fips_code) 'county'::text, fips_code::text, value
        FROM zillow_county
        WHERE metric_name = 'zhvi' AND fips_code IS NOT NULL
          AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
        ORDER BY fips_code, period_date DESC )
    UNION ALL
    ( SELECT DISTINCT ON (region_name) 'zip'::text, region_name::text, value
        FROM zillow_zip
        WHERE metric_name = 'zhvi' AND region_name IS NOT NULL
          AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
        ORDER BY region_name, period_date DESC )
  ),
  -- Latest ZORI (rent) per region: same shape as latest_home_value.
  latest_rent AS (
    ( SELECT DISTINCT ON (cbsa_code) 'metro'::text AS geo_level, cbsa_code::text AS join_id, value AS rent
        FROM zillow_metro
        WHERE metric_name = 'zori' AND cbsa_code IS NOT NULL
          AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
        ORDER BY cbsa_code, period_date DESC )
    UNION ALL
    ( SELECT DISTINCT ON (fips_code) 'county'::text, fips_code::text, value
        FROM zillow_county
        WHERE metric_name = 'zori' AND fips_code IS NOT NULL
          AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
        ORDER BY fips_code, period_date DESC )
    UNION ALL
    ( SELECT DISTINCT ON (region_name) 'zip'::text, region_name::text, value
        FROM zillow_zip
        WHERE metric_name = 'zori' AND region_name IS NOT NULL
          AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
        ORDER BY region_name, period_date DESC )
  )
  SELECT
    s.geography,
    s.location_id,
    s.location_name,
    COALESCE((regexp_match(s.location_name, ',\s*([A-Z]{2})'))[1], zs.state_code) AS state_code,
    s.score, s.grade, s.confidence, s.median_price,
    hv.home_value,
    rt.rent,
    cm.cap_rate, cm.gross_yield, cm.rent_to_price_ratio, cm.grm,
    cm.months_of_supply, cm.overvalued_pct,
    s.score_date,
    now()
  FROM latest_scores s
  LEFT JOIN latest_cm cm
    ON cm.geography_type = s.geography AND cm.geography_id = s.location_id
  LEFT JOIN zip_state zs
    ON s.geography = 'zip' AND zs.region_name = s.location_id
  LEFT JOIN latest_home_value hv
    ON hv.geo_level = s.geography AND hv.join_id = s.location_id
  LEFT JOIN latest_rent rt
    ON rt.geo_level = s.geography AND rt.join_id = s.location_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_screener_snapshot() TO service_role;
