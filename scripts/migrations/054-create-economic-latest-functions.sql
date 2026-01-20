-- Migration 054: Create optimized functions for fetching latest economic data
-- These functions use DISTINCT ON to efficiently get the most recent record per region
-- Much faster than fetching all historical data and filtering in application code

-- Function to get latest county economic data for a specific metric
CREATE OR REPLACE FUNCTION get_latest_economic_county(p_metric TEXT)
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
  ORDER BY ec.fips_code, ec.period_date DESC;
$$;

-- Function to get latest metro economic data for a specific metric
CREATE OR REPLACE FUNCTION get_latest_economic_metro(p_metric TEXT)
RETURNS TABLE (
  cbsa_code VARCHAR(5),
  cbsa_title VARCHAR(200),
  state_fips VARCHAR(2),
  period_date DATE,
  metric_value DECIMAL
)
LANGUAGE SQL
STABLE
AS $$
  SELECT DISTINCT ON (em.cbsa_code)
    em.cbsa_code,
    em.cbsa_title,
    em.state_fips,
    em.period_date,
    CASE p_metric
      WHEN 'unemployment_rate' THEN em.unemployment_rate
      WHEN 'unemployment_rate_yoy' THEN em.unemployment_rate_yoy
      WHEN 'employment_yoy' THEN em.employment_yoy
      WHEN 'gdp_yoy' THEN em.gdp_yoy
      WHEN 'gdp_millions' THEN em.gdp_millions
      WHEN 'rpp_all_items' THEN em.rpp_all_items
      ELSE NULL
    END AS metric_value
  FROM economic_metro em
  WHERE
    CASE p_metric
      WHEN 'unemployment_rate' THEN em.unemployment_rate IS NOT NULL
      WHEN 'unemployment_rate_yoy' THEN em.unemployment_rate_yoy IS NOT NULL
      WHEN 'employment_yoy' THEN em.employment_yoy IS NOT NULL
      WHEN 'gdp_yoy' THEN em.gdp_yoy IS NOT NULL
      WHEN 'gdp_millions' THEN em.gdp_millions IS NOT NULL
      WHEN 'rpp_all_items' THEN em.rpp_all_items IS NOT NULL
      ELSE FALSE
    END
  ORDER BY em.cbsa_code, em.period_date DESC;
$$;

-- Function to get latest state economic data for a specific metric
CREATE OR REPLACE FUNCTION get_latest_economic_state(p_metric TEXT)
RETURNS TABLE (
  state_fips VARCHAR(2),
  state_name VARCHAR(100),
  state_abbrev VARCHAR(2),
  period_date DATE,
  metric_value DECIMAL
)
LANGUAGE SQL
STABLE
AS $$
  SELECT DISTINCT ON (es.state_fips)
    es.state_fips,
    es.state_name,
    es.state_abbrev,
    es.period_date,
    CASE p_metric
      WHEN 'unemployment_rate' THEN es.unemployment_rate
      WHEN 'unemployment_rate_yoy' THEN es.unemployment_rate_yoy
      WHEN 'employment_yoy' THEN es.employment_yoy
      WHEN 'gdp_yoy' THEN es.gdp_yoy
      WHEN 'gdp_millions' THEN es.gdp_millions
      WHEN 'rpp_all_items' THEN es.rpp_all_items
      ELSE NULL
    END AS metric_value
  FROM economic_state es
  WHERE
    CASE p_metric
      WHEN 'unemployment_rate' THEN es.unemployment_rate IS NOT NULL
      WHEN 'unemployment_rate_yoy' THEN es.unemployment_rate_yoy IS NOT NULL
      WHEN 'employment_yoy' THEN es.employment_yoy IS NOT NULL
      WHEN 'gdp_yoy' THEN es.gdp_yoy IS NOT NULL
      WHEN 'gdp_millions' THEN es.gdp_millions IS NOT NULL
      WHEN 'rpp_all_items' THEN es.rpp_all_items IS NOT NULL
      ELSE FALSE
    END
  ORDER BY es.state_fips, es.period_date DESC;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_latest_economic_county(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_latest_economic_metro(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_latest_economic_state(TEXT) TO authenticated, anon, service_role;

-- Add indexes to improve DISTINCT ON performance
CREATE INDEX IF NOT EXISTS idx_economic_county_fips_date
ON economic_county(fips_code, period_date DESC);

CREATE INDEX IF NOT EXISTS idx_economic_metro_cbsa_date
ON economic_metro(cbsa_code, period_date DESC);

CREATE INDEX IF NOT EXISTS idx_economic_state_fips_date
ON economic_state(state_fips, period_date DESC);
