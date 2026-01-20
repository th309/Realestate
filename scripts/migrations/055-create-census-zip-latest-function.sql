-- Migration 055: Create optimized function for fetching latest census ZIP data
-- Uses DISTINCT ON to efficiently get the most recent year's data per ZCTA
-- Returns ~33,000 rows in a single query instead of 33+ paginated API calls

CREATE OR REPLACE FUNCTION get_latest_census_zip(p_metric TEXT)
RETURNS TABLE (
  zcta VARCHAR(5),
  year INTEGER,
  state_fips VARCHAR(2),
  metric_value DECIMAL
)
LANGUAGE SQL
STABLE
AS $$
  SELECT DISTINCT ON (cz.zcta)
    cz.zcta,
    cz.year,
    cz.state_fips,
    CASE p_metric
      WHEN 'total_population' THEN cz.total_population
      WHEN 'population_yoy' THEN cz.population_yoy
      WHEN 'median_household_income' THEN cz.median_household_income
      WHEN 'income_yoy' THEN cz.income_yoy
      WHEN 'median_age' THEN cz.median_age
      WHEN 'homeownership_rate' THEN cz.homeownership_rate
      ELSE NULL
    END AS metric_value
  FROM census_zip cz
  WHERE
    CASE p_metric
      WHEN 'total_population' THEN cz.total_population IS NOT NULL
      WHEN 'population_yoy' THEN cz.population_yoy IS NOT NULL
      WHEN 'median_household_income' THEN cz.median_household_income IS NOT NULL
      WHEN 'income_yoy' THEN cz.income_yoy IS NOT NULL
      WHEN 'median_age' THEN cz.median_age IS NOT NULL
      WHEN 'homeownership_rate' THEN cz.homeownership_rate IS NOT NULL
      ELSE FALSE
    END
  ORDER BY cz.zcta, cz.year DESC;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_latest_census_zip(TEXT) TO authenticated, anon, service_role;

-- Add index to improve DISTINCT ON performance
CREATE INDEX IF NOT EXISTS idx_census_zip_zcta_year
ON census_zip(zcta, year DESC);
