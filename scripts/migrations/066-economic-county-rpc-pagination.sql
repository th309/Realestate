-- Migration 066: Add LIMIT/OFFSET to get_latest_economic_county so the backend can paginate
-- and retrieve all ~3200 counties. PostgREST/Supabase applies a default 1000-row response
-- limit; .range() on RPC may not paginate correctly, so we paginate inside the function.
--
-- Root cause of missing VA/CT (and other) counties: only the first 1000 rows were returned.

CREATE OR REPLACE FUNCTION get_latest_economic_county(
  p_metric TEXT,
  p_limit INT DEFAULT NULL,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  fips_code VARCHAR(5),
  county_name VARCHAR(100),
  state_fips VARCHAR(2),
  state_name VARCHAR(100),
  period_date DATE,
  metric_value DECIMAL
)
LANGUAGE SQL
STABLE
AS $$
  SELECT sub.fips_code, sub.county_name, sub.state_fips, sub.state_name, sub.period_date, sub.metric_value
  FROM (
    SELECT DISTINCT ON (ec.fips_code)
      ec.fips_code,
      ec.county_name,
      ec.state_fips,
      ec.state_name,
      ec.period_date,
      CASE p_metric
        WHEN 'unemployment_rate' THEN ec.unemployment_rate
        WHEN 'unemployment_rate_yoy' THEN ec.unemployment_rate_yoy
        WHEN 'employment_yoy' THEN ec.employment_yoy
        WHEN 'gdp_yoy' THEN ec.gdp_yoy
        WHEN 'gdp_millions' THEN ec.gdp_millions
        ELSE NULL
      END AS metric_value
    FROM economic_county ec
    WHERE
      CASE p_metric
        WHEN 'unemployment_rate' THEN ec.unemployment_rate IS NOT NULL
        WHEN 'unemployment_rate_yoy' THEN ec.unemployment_rate_yoy IS NOT NULL
        WHEN 'employment_yoy' THEN ec.employment_yoy IS NOT NULL
        WHEN 'gdp_yoy' THEN ec.gdp_yoy IS NOT NULL
        WHEN 'gdp_millions' THEN ec.gdp_millions IS NOT NULL
        ELSE FALSE
      END
    ORDER BY ec.fips_code, ec.period_date DESC
  ) sub
  ORDER BY sub.fips_code
  LIMIT COALESCE(NULLIF(p_limit, 0), 2147483647)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

-- Keep same grants
GRANT EXECUTE ON FUNCTION get_latest_economic_county(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_latest_economic_county(TEXT, INT, INT) TO anon;
GRANT EXECUTE ON FUNCTION get_latest_economic_county(TEXT, INT, INT) TO service_role;

COMMENT ON FUNCTION get_latest_economic_county(TEXT, INT, INT) IS 'Latest economic metric per county; p_limit/p_offset enable pagination past API 1000-row limit.';
