-- Score "movers": precompute PropertyIQ Score change over 1m/3m/6m/1y/3y/5y into
-- screener_snapshot so the /screener page can screen + leaderboard biggest gainers
-- and losers without touching the 10M-row history table at request time.
--
-- Each delta = round(score(latest) - score(latest - N months)) for the region,
-- matched on exact month-end (scores are dense monthly, month-end dated, back to
-- 2001). NULL when the region has no score at that baseline month-end. Baselines
-- join propertyiq_scores_v2 on (geography, location_id, score_type, score_date),
-- which is exactly the unique_normalized_score index — pure index seeks.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE so applying via MCP now
-- and again on deploy is harmless.

ALTER TABLE screener_snapshot
  ADD COLUMN IF NOT EXISTS score_chg_1m  numeric,
  ADD COLUMN IF NOT EXISTS score_chg_3m  numeric,
  ADD COLUMN IF NOT EXISTS score_chg_6m  numeric,
  ADD COLUMN IF NOT EXISTS score_chg_1y  numeric,
  ADD COLUMN IF NOT EXISTS score_chg_3y  numeric,
  ADD COLUMN IF NOT EXISTS score_chg_5y  numeric;

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
    score_chg_1m, score_chg_3m, score_chg_6m, score_chg_1y, score_chg_3y, score_chg_5y,
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
    ROUND(s.score - b1.score)::numeric,
    ROUND(s.score - b3.score)::numeric,
    ROUND(s.score - b6.score)::numeric,
    ROUND(s.score - b12.score)::numeric,
    ROUND(s.score - b36.score)::numeric,
    ROUND(s.score - b60.score)::numeric,
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
    ON rt.geo_level = s.geography AND rt.join_id = s.location_id
  -- Baseline scores at exact month-end N months before this region's latest score.
  -- month_end(N) = (date_trunc('month', d0) - make_interval(months => N-1) - 1 day).
  LEFT JOIN propertyiq_scores_v2 b1
    ON b1.geography = s.geography AND b1.location_id = s.location_id
   AND b1.score_type = 'propertyiq'
   AND b1.score_date = (date_trunc('month', s.score_date) - INTERVAL '1 day')::date
  LEFT JOIN propertyiq_scores_v2 b3
    ON b3.geography = s.geography AND b3.location_id = s.location_id
   AND b3.score_type = 'propertyiq'
   AND b3.score_date = (date_trunc('month', s.score_date) - INTERVAL '2 months' - INTERVAL '1 day')::date
  LEFT JOIN propertyiq_scores_v2 b6
    ON b6.geography = s.geography AND b6.location_id = s.location_id
   AND b6.score_type = 'propertyiq'
   AND b6.score_date = (date_trunc('month', s.score_date) - INTERVAL '5 months' - INTERVAL '1 day')::date
  LEFT JOIN propertyiq_scores_v2 b12
    ON b12.geography = s.geography AND b12.location_id = s.location_id
   AND b12.score_type = 'propertyiq'
   AND b12.score_date = (date_trunc('month', s.score_date) - INTERVAL '11 months' - INTERVAL '1 day')::date
  LEFT JOIN propertyiq_scores_v2 b36
    ON b36.geography = s.geography AND b36.location_id = s.location_id
   AND b36.score_type = 'propertyiq'
   AND b36.score_date = (date_trunc('month', s.score_date) - INTERVAL '35 months' - INTERVAL '1 day')::date
  LEFT JOIN propertyiq_scores_v2 b60
    ON b60.geography = s.geography AND b60.location_id = s.location_id
   AND b60.score_type = 'propertyiq'
   AND b60.score_date = (date_trunc('month', s.score_date) - INTERVAL '59 months' - INTERVAL '1 day')::date;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_screener_snapshot() TO service_role;
