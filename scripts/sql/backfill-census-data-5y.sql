-- Backfill census_data from census_* and economic_* tables (last 5 years)

-- State metrics (demographics + housing)
WITH cutoff AS (SELECT MAX(year) AS max_year FROM census_state),
source AS (
  SELECT state_fips AS geography_id,
         'state' AS geography_type,
         state_name AS geography_name,
         year,
         'demographics' AS category,
         'median_income' AS metric_name,
         median_household_income::numeric AS value,
         'census_state' AS source_table
  FROM census_state, cutoff
  WHERE year >= cutoff.max_year - 4 AND median_household_income IS NOT NULL

  UNION ALL
  SELECT state_fips, 'state', state_name, year, 'demographics', 'population', total_population::numeric, 'census_state'
  FROM census_state, cutoff
  WHERE year >= cutoff.max_year - 4 AND total_population IS NOT NULL

  UNION ALL
  SELECT state_fips, 'state', state_name, year, 'demographics', 'population_growth', population_yoy::numeric, 'census_state'
  FROM census_state, cutoff
  WHERE year >= cutoff.max_year - 4 AND population_yoy IS NOT NULL

  UNION ALL
  SELECT state_fips, 'state', state_name, year, 'housing', 'homeownership_rate', homeownership_rate::numeric, 'census_state'
  FROM census_state, cutoff
  WHERE year >= cutoff.max_year - 4 AND homeownership_rate IS NOT NULL

  UNION ALL
  SELECT state_fips,
         'state',
         state_name,
         year,
         'housing',
         'vacancy_rate',
         CASE
           WHEN total_housing_units IS NULL OR total_housing_units = 0 THEN NULL
           ELSE ((total_housing_units - COALESCE(owner_occupied_units, 0) - COALESCE(renter_occupied_units, 0))::numeric / total_housing_units) * 100
         END AS value,
         'census_state' AS source_table
  FROM census_state, cutoff
  WHERE year >= cutoff.max_year - 4
)
INSERT INTO census_data (geography_id, geography_type, geography_name, year, category, metric_name, value, source_table)
SELECT geography_id, geography_type, geography_name, year, category, metric_name, value, source_table
FROM source
WHERE value IS NOT NULL
ON CONFLICT (geography_id, geography_type, year, metric_name)
DO UPDATE SET
  value = EXCLUDED.value,
  geography_name = EXCLUDED.geography_name,
  category = EXCLUDED.category,
  source_table = EXCLUDED.source_table,
  updated_at = NOW();

-- Metro metrics (demographics + housing)
WITH cutoff AS (SELECT MAX(year) AS max_year FROM census_metro),
source AS (
  SELECT cbsa_code AS geography_id,
         'metro' AS geography_type,
         cbsa_title AS geography_name,
         year,
         'demographics' AS category,
         'median_income' AS metric_name,
         median_household_income::numeric AS value,
         'census_metro' AS source_table
  FROM census_metro, cutoff
  WHERE year >= cutoff.max_year - 4 AND median_household_income IS NOT NULL

  UNION ALL
  SELECT cbsa_code, 'metro', cbsa_title, year, 'demographics', 'population', total_population::numeric, 'census_metro'
  FROM census_metro, cutoff
  WHERE year >= cutoff.max_year - 4 AND total_population IS NOT NULL

  UNION ALL
  SELECT cbsa_code, 'metro', cbsa_title, year, 'demographics', 'population_growth', population_yoy::numeric, 'census_metro'
  FROM census_metro, cutoff
  WHERE year >= cutoff.max_year - 4 AND population_yoy IS NOT NULL

  UNION ALL
  SELECT cbsa_code, 'metro', cbsa_title, year, 'housing', 'homeownership_rate', homeownership_rate::numeric, 'census_metro'
  FROM census_metro, cutoff
  WHERE year >= cutoff.max_year - 4 AND homeownership_rate IS NOT NULL

  UNION ALL
  SELECT cbsa_code,
         'metro',
         cbsa_title,
         year,
         'housing',
         'vacancy_rate',
         CASE
           WHEN total_housing_units IS NULL OR total_housing_units = 0 THEN NULL
           ELSE ((total_housing_units - COALESCE(owner_occupied_units, 0) - COALESCE(renter_occupied_units, 0))::numeric / total_housing_units) * 100
         END AS value,
         'census_metro' AS source_table
  FROM census_metro, cutoff
  WHERE year >= cutoff.max_year - 4
)
INSERT INTO census_data (geography_id, geography_type, geography_name, year, category, metric_name, value, source_table)
SELECT geography_id, geography_type, geography_name, year, category, metric_name, value, source_table
FROM source
WHERE value IS NOT NULL
ON CONFLICT (geography_id, geography_type, year, metric_name)
DO UPDATE SET
  value = EXCLUDED.value,
  geography_name = EXCLUDED.geography_name,
  category = EXCLUDED.category,
  source_table = EXCLUDED.source_table,
  updated_at = NOW();

-- County metrics (demographics + housing)
WITH cutoff AS (SELECT MAX(year) AS max_year FROM census_county),
source AS (
  SELECT fips_code AS geography_id,
         'county' AS geography_type,
         county_name AS geography_name,
         year,
         'demographics' AS category,
         'median_income' AS metric_name,
         median_household_income::numeric AS value,
         'census_county' AS source_table
  FROM census_county, cutoff
  WHERE year >= cutoff.max_year - 4 AND median_household_income IS NOT NULL

  UNION ALL
  SELECT fips_code, 'county', county_name, year, 'demographics', 'population', total_population::numeric, 'census_county'
  FROM census_county, cutoff
  WHERE year >= cutoff.max_year - 4 AND total_population IS NOT NULL

  UNION ALL
  SELECT fips_code, 'county', county_name, year, 'demographics', 'population_growth', population_yoy::numeric, 'census_county'
  FROM census_county, cutoff
  WHERE year >= cutoff.max_year - 4 AND population_yoy IS NOT NULL

  UNION ALL
  SELECT fips_code, 'county', county_name, year, 'housing', 'homeownership_rate', homeownership_rate::numeric, 'census_county'
  FROM census_county, cutoff
  WHERE year >= cutoff.max_year - 4 AND homeownership_rate IS NOT NULL

  UNION ALL
  SELECT fips_code,
         'county',
         county_name,
         year,
         'housing',
         'vacancy_rate',
         CASE
           WHEN total_housing_units IS NULL OR total_housing_units = 0 THEN NULL
           ELSE ((total_housing_units - COALESCE(owner_occupied_units, 0) - COALESCE(renter_occupied_units, 0))::numeric / total_housing_units) * 100
         END AS value,
         'census_county' AS source_table
  FROM census_county, cutoff
  WHERE year >= cutoff.max_year - 4
)
INSERT INTO census_data (geography_id, geography_type, geography_name, year, category, metric_name, value, source_table)
SELECT geography_id, geography_type, geography_name, year, category, metric_name, value, source_table
FROM source
WHERE value IS NOT NULL
ON CONFLICT (geography_id, geography_type, year, metric_name)
DO UPDATE SET
  value = EXCLUDED.value,
  geography_name = EXCLUDED.geography_name,
  category = EXCLUDED.category,
  source_table = EXCLUDED.source_table,
  updated_at = NOW();

-- ZIP metrics (demographics + housing)
WITH cutoff AS (SELECT MAX(year) AS max_year FROM census_zip),
source AS (
  SELECT zcta AS geography_id,
         'zip' AS geography_type,
         'ZIP ' || zcta AS geography_name,
         year,
         'demographics' AS category,
         'median_income' AS metric_name,
         median_household_income::numeric AS value,
         'census_zip' AS source_table
  FROM census_zip, cutoff
  WHERE year >= cutoff.max_year - 4 AND median_household_income IS NOT NULL

  UNION ALL
  SELECT zcta, 'zip', 'ZIP ' || zcta, year, 'demographics', 'population', total_population::numeric, 'census_zip'
  FROM census_zip, cutoff
  WHERE year >= cutoff.max_year - 4 AND total_population IS NOT NULL

  UNION ALL
  SELECT zcta, 'zip', 'ZIP ' || zcta, year, 'demographics', 'population_growth', population_yoy::numeric, 'census_zip'
  FROM census_zip, cutoff
  WHERE year >= cutoff.max_year - 4 AND population_yoy IS NOT NULL

  UNION ALL
  SELECT zcta, 'zip', 'ZIP ' || zcta, year, 'housing', 'homeownership_rate', homeownership_rate::numeric, 'census_zip'
  FROM census_zip, cutoff
  WHERE year >= cutoff.max_year - 4 AND homeownership_rate IS NOT NULL

  UNION ALL
  SELECT zcta,
         'zip',
         'ZIP ' || zcta,
         year,
         'housing',
         'vacancy_rate',
         CASE
           WHEN total_housing_units IS NULL OR total_housing_units = 0 THEN NULL
           ELSE ((total_housing_units - COALESCE(owner_occupied_units, 0) - COALESCE(renter_occupied_units, 0))::numeric / total_housing_units) * 100
         END AS value,
         'census_zip' AS source_table
  FROM census_zip, cutoff
  WHERE year >= cutoff.max_year - 4
)
INSERT INTO census_data (geography_id, geography_type, geography_name, year, category, metric_name, value, source_table)
SELECT geography_id, geography_type, geography_name, year, category, metric_name, value, source_table
FROM source
WHERE value IS NOT NULL
ON CONFLICT (geography_id, geography_type, year, metric_name)
DO UPDATE SET
  value = EXCLUDED.value,
  geography_name = EXCLUDED.geography_name,
  category = EXCLUDED.category,
  source_table = EXCLUDED.source_table,
  updated_at = NOW();

-- Unemployment rate from economic_* (yearly average)
WITH cutoff AS (SELECT EXTRACT(YEAR FROM MAX(period_date))::int AS max_year FROM economic_state),
source AS (
  SELECT state_fips AS geography_id,
         'state' AS geography_type,
         MAX(state_name) AS geography_name,
         EXTRACT(YEAR FROM period_date)::int AS year,
         'economics' AS category,
         'unemployment_rate' AS metric_name,
         AVG(unemployment_rate)::numeric AS value,
         'economic_state' AS source_table
  FROM economic_state
  GROUP BY state_fips, EXTRACT(YEAR FROM period_date)::int
)
INSERT INTO census_data (geography_id, geography_type, geography_name, year, category, metric_name, value, source_table)
SELECT geography_id, geography_type, geography_name, year, category, metric_name, value, source_table
FROM source, cutoff
WHERE year >= cutoff.max_year - 4 AND value IS NOT NULL
ON CONFLICT (geography_id, geography_type, year, metric_name)
DO UPDATE SET
  value = EXCLUDED.value,
  geography_name = EXCLUDED.geography_name,
  category = EXCLUDED.category,
  source_table = EXCLUDED.source_table,
  updated_at = NOW();

WITH cutoff AS (SELECT EXTRACT(YEAR FROM MAX(period_date))::int AS max_year FROM economic_metro),
source AS (
  SELECT cbsa_code AS geography_id,
         'metro' AS geography_type,
         MAX(cbsa_title) AS geography_name,
         EXTRACT(YEAR FROM period_date)::int AS year,
         'economics' AS category,
         'unemployment_rate' AS metric_name,
         AVG(unemployment_rate)::numeric AS value,
         'economic_metro' AS source_table
  FROM economic_metro
  GROUP BY cbsa_code, EXTRACT(YEAR FROM period_date)::int
)
INSERT INTO census_data (geography_id, geography_type, geography_name, year, category, metric_name, value, source_table)
SELECT geography_id, geography_type, geography_name, year, category, metric_name, value, source_table
FROM source, cutoff
WHERE year >= cutoff.max_year - 4 AND value IS NOT NULL
ON CONFLICT (geography_id, geography_type, year, metric_name)
DO UPDATE SET
  value = EXCLUDED.value,
  geography_name = EXCLUDED.geography_name,
  category = EXCLUDED.category,
  source_table = EXCLUDED.source_table,
  updated_at = NOW();

WITH cutoff AS (SELECT EXTRACT(YEAR FROM MAX(period_date))::int AS max_year FROM economic_county),
source AS (
  SELECT fips_code AS geography_id,
         'county' AS geography_type,
         MAX(county_name) AS geography_name,
         EXTRACT(YEAR FROM period_date)::int AS year,
         'economics' AS category,
         'unemployment_rate' AS metric_name,
         AVG(unemployment_rate)::numeric AS value,
         'economic_county' AS source_table
  FROM economic_county
  GROUP BY fips_code, EXTRACT(YEAR FROM period_date)::int
)
INSERT INTO census_data (geography_id, geography_type, geography_name, year, category, metric_name, value, source_table)
SELECT geography_id, geography_type, geography_name, year, category, metric_name, value, source_table
FROM source, cutoff
WHERE year >= cutoff.max_year - 4 AND value IS NOT NULL
ON CONFLICT (geography_id, geography_type, year, metric_name)
DO UPDATE SET
  value = EXCLUDED.value,
  geography_name = EXCLUDED.geography_name,
  category = EXCLUDED.category,
  source_table = EXCLUDED.source_table,
  updated_at = NOW();
