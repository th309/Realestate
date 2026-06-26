-- Beta backlog #26/#29: add a market-size reference to screener_snapshot so the
-- DEFAULT Hottest view + Movers can apply a population floor (de-noise micro-markets)
-- WITHOUT any score change. metro/county use own population; ZIP inherits its parent
-- county's population (next-higher-geo reference, same pattern as score/metric
-- geography inheritance per CLAUDE.md §5.1). Unknown population stays NULL (treated as
-- pass-through by the floor filter so legitimate unmatched metros are never hidden).

ALTER TABLE screener_snapshot ADD COLUMN IF NOT EXISTS population integer;

-- Recreate the monthly refresh function with the population column populated.
CREATE OR REPLACE FUNCTION public.refresh_screener_snapshot()
 RETURNS integer
 LANGUAGE plpgsql
 SET statement_timeout TO '600s'
AS $function$
DECLARE
  n integer;
BEGIN
  TRUNCATE screener_snapshot;

  INSERT INTO screener_snapshot (
    geo_level, region_id, region_name, state_code,
    score, grade, confidence, median_price, home_value, rent,
    cap_rate, gross_yield, rent_to_price_ratio, grm, months_of_supply, overvalued_pct,
    score_chg_1m, score_chg_3m, score_chg_6m, score_chg_1y, score_chg_3y, score_chg_5y,
    population,
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
    -- market-size reference: own population for metro/county, parent-county for zip
    COALESCE(gself.population, gcounty.population)::integer,
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
  LEFT JOIN geographies gself
    ON gself.geography_type = s.geography AND gself.geography_id = s.location_id
  LEFT JOIN geographies gcounty
    ON s.geography = 'zip' AND gcounty.geography_type = 'county'
   AND gcounty.geography_id = gself.parent_county_id
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
$function$;

-- Backfill the population reference into the CURRENT snapshot (avoids a full
-- TRUNCATE+rebuild now; the function above keeps it current on the next monthly run).
UPDATE screener_snapshot s
SET population = sub.pop
FROM (
  SELECT s2.geo_level, s2.region_id,
         COALESCE(gself.population, gcounty.population)::integer AS pop
  FROM screener_snapshot s2
  LEFT JOIN geographies gself
    ON gself.geography_type = s2.geo_level AND gself.geography_id = s2.region_id
  LEFT JOIN geographies gcounty
    ON s2.geo_level = 'zip' AND gcounty.geography_type = 'county'
   AND gcounty.geography_id = gself.parent_county_id
) sub
WHERE sub.geo_level = s.geo_level AND sub.region_id = s.region_id;
