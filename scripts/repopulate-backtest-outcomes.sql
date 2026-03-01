-- =============================================================================
-- Repopulate Backtest Outcomes with Full Fallback Chain (v2 - optimized)
-- =============================================================================
-- Key optimization: Pre-materialize a score_month mapping table to avoid
-- DATE_TRUNC() in every UPDATE join. All UPDATEs join via pre-computed keys.
-- =============================================================================

\set ON_ERROR_STOP on
\timing on
SET statement_timeout = '600s';

-- =============================================================================
-- PHASE 1: STATE_CODE BACKFILL (must happen before mapping table creation)
-- =============================================================================

\echo '=== PHASE 1: Backfilling state_code ==='

-- 1a. Mapping tables
DROP TABLE IF EXISTS _staging_state_fips_map;
CREATE TABLE _staging_state_fips_map AS
SELECT DISTINCT state_fips, state_abbrev
FROM geography_crosswalk
WHERE state_fips IS NOT NULL AND state_abbrev IS NOT NULL;

DROP TABLE IF EXISTS _staging_cbsa_state_map;
CREATE TABLE _staging_cbsa_state_map AS
SELECT DISTINCT ON (cbsa_code) cbsa_code, state_abbrev
FROM (
  SELECT cbsa_code, state_abbrev, SUM(county_population) AS total_pop
  FROM geography_crosswalk
  WHERE cbsa_code IS NOT NULL AND state_abbrev IS NOT NULL
  GROUP BY cbsa_code, state_abbrev
) sub
ORDER BY cbsa_code, total_pop DESC NULLS LAST;
CREATE INDEX ON _staging_cbsa_state_map (cbsa_code);

DROP TABLE IF EXISTS _staging_zip_state_map;
CREATE TABLE _staging_zip_state_map AS
SELECT DISTINCT ON (zip_code) zip_code, state_abbrev
FROM geography_crosswalk
WHERE zip_code IS NOT NULL AND state_abbrev IS NOT NULL
ORDER BY zip_code, county_population DESC NULLS LAST;
CREATE INDEX ON _staging_zip_state_map (zip_code);

-- 1b. Backfill county
\echo 'Backfilling county state_code...'
UPDATE propertyiq_backtest_outcomes o
SET state_code = sm.state_abbrev
FROM _staging_state_fips_map sm
WHERE o.geography_type = 'county'
  AND o.state_code IS NULL
  AND LEFT(o.geography_id, 2) = sm.state_fips;

-- 1c. Backfill metro
\echo 'Backfilling metro state_code...'
UPDATE propertyiq_backtest_outcomes o
SET state_code = cm.state_abbrev
FROM _staging_cbsa_state_map cm
WHERE o.geography_type = 'metro'
  AND o.state_code IS NULL
  AND o.geography_id = cm.cbsa_code;

-- 1d. Backfill ZIP
\echo 'Backfilling zip state_code...'
UPDATE propertyiq_backtest_outcomes o
SET state_code = zm.state_abbrev
FROM _staging_zip_state_map zm
WHERE o.geography_type = 'zip'
  AND o.state_code IS NULL
  AND o.geography_id = zm.zip_code;

\echo 'State code coverage after backfill:'
SELECT geography_type,
  COUNT(*) AS total,
  COUNT(state_code) AS has_state,
  ROUND(100.0 * COUNT(state_code) / COUNT(*), 1) AS pct
FROM propertyiq_backtest_outcomes
GROUP BY geography_type ORDER BY geography_type;

-- =============================================================================
-- PHASE 1b: Create score_month mapping (AFTER state_code backfill)
-- =============================================================================

\echo '=== Creating score_month mapping ==='

DROP TABLE IF EXISTS _staging_outcome_months;
CREATE TABLE _staging_outcome_months AS
SELECT id, geography_type, geography_id, state_code, score_date,
  DATE_TRUNC('month', score_date)::date AS score_month
FROM propertyiq_backtest_outcomes;

CREATE INDEX ON _staging_outcome_months (geography_type, geography_id, score_month);
CREATE INDEX ON _staging_outcome_months (score_month);
CREATE INDEX ON _staging_outcome_months (id);

\echo 'Outcome months mapping created:'
SELECT geography_type, COUNT(*) FROM _staging_outcome_months GROUP BY geography_type ORDER BY geography_type;

-- =============================================================================
-- PHASE 2: CREATE STAGING TABLES (Price, Rent, Benchmarks)
-- =============================================================================

\echo '=== PHASE 2: Creating staging tables ==='

-- 2a. PRICE - METRO (sequential INSERT approach - avoids FULL OUTER JOIN memory spike)
\echo 'Creating _staging_price_metro...'
DROP TABLE IF EXISTS _staging_price_metro;
CREATE TABLE _staging_price_metro (
  geo_id TEXT NOT NULL,
  price_date DATE NOT NULL,
  price_value NUMERIC NOT NULL,
  price_source TEXT NOT NULL
);

-- First: Zillow ZHVI (primary)
INSERT INTO _staging_price_metro
SELECT cbsa_code, DATE_TRUNC('month', period_date)::date, value, 'zillow'
FROM zillow_metro
WHERE metric_name = 'zhvi' AND value IS NOT NULL AND cbsa_code IS NOT NULL;

-- Second: Redfin where Zillow is missing
INSERT INTO _staging_price_metro
SELECT r.cbsa_code, DATE_TRUNC('month', r.period_end)::date, r.median_sale_price, 'redfin'
FROM redfin_metro r
WHERE r.property_type = 'All Residential' AND r.median_sale_price IS NOT NULL AND r.cbsa_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM _staging_price_metro sp
    WHERE sp.geo_id = r.cbsa_code AND sp.price_date = DATE_TRUNC('month', r.period_end)::date
  );

-- Third: Realtor where both are missing
INSERT INTO _staging_price_metro
SELECT rt.cbsa_code, DATE_TRUNC('month', rt.period_date)::date, rt.median_listing_price, 'realtor'
FROM realtor_metro rt
WHERE rt.median_listing_price IS NOT NULL AND rt.cbsa_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM _staging_price_metro sp
    WHERE sp.geo_id = rt.cbsa_code AND sp.price_date = DATE_TRUNC('month', rt.period_date)::date
  );

CREATE INDEX ON _staging_price_metro (geo_id, price_date);

\echo 'Metro price rows:'
SELECT COUNT(*), COUNT(DISTINCT geo_id) AS metros FROM _staging_price_metro;
SELECT price_source, COUNT(*) FROM _staging_price_metro GROUP BY price_source;

-- 2b. PRICE - COUNTY
\echo 'Creating _staging_price_county...'
DROP TABLE IF EXISTS _staging_price_county;
CREATE TABLE _staging_price_county (
  geo_id TEXT NOT NULL,
  price_date DATE NOT NULL,
  price_value NUMERIC NOT NULL,
  price_source TEXT NOT NULL
);

INSERT INTO _staging_price_county
SELECT fips_code, DATE_TRUNC('month', period_date)::date, value, 'zillow'
FROM zillow_county
WHERE metric_name = 'zhvi' AND value IS NOT NULL AND fips_code IS NOT NULL;

INSERT INTO _staging_price_county
SELECT r.fips_code, DATE_TRUNC('month', r.period_end)::date, r.median_sale_price, 'redfin'
FROM redfin_county r
WHERE r.property_type = 'All Residential' AND r.median_sale_price IS NOT NULL AND r.fips_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM _staging_price_county sp
    WHERE sp.geo_id = r.fips_code AND sp.price_date = DATE_TRUNC('month', r.period_end)::date
  );

INSERT INTO _staging_price_county
SELECT rt.county_fips, DATE_TRUNC('month', rt.period_date)::date, rt.median_listing_price, 'realtor'
FROM realtor_county rt
WHERE rt.median_listing_price IS NOT NULL AND rt.county_fips IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM _staging_price_county sp
    WHERE sp.geo_id = rt.county_fips AND sp.price_date = DATE_TRUNC('month', rt.period_date)::date
  );

CREATE INDEX ON _staging_price_county (geo_id, price_date);

\echo 'County price rows:'
SELECT COUNT(*), COUNT(DISTINCT geo_id) AS counties FROM _staging_price_county;
SELECT price_source, COUNT(*) FROM _staging_price_county GROUP BY price_source;

-- 2c. PRICE - ZIP
\echo 'Creating _staging_price_zip...'
DROP TABLE IF EXISTS _staging_price_zip;
CREATE TABLE _staging_price_zip (
  geo_id TEXT NOT NULL,
  price_date DATE NOT NULL,
  price_value NUMERIC NOT NULL,
  price_source TEXT NOT NULL
);

INSERT INTO _staging_price_zip
SELECT region_name, DATE_TRUNC('month', period_date)::date, value, 'zillow'
FROM zillow_zip
WHERE metric_name = 'zhvi' AND value IS NOT NULL AND region_name IS NOT NULL;

INSERT INTO _staging_price_zip
SELECT r.zip_code, DATE_TRUNC('month', r.period_end)::date, r.median_sale_price, 'redfin'
FROM redfin_zip r
WHERE r.property_type = 'All Residential' AND r.median_sale_price IS NOT NULL AND r.zip_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM _staging_price_zip sp
    WHERE sp.geo_id = r.zip_code AND sp.price_date = DATE_TRUNC('month', r.period_end)::date
  );

INSERT INTO _staging_price_zip
SELECT rt.postal_code, DATE_TRUNC('month', rt.period_date)::date, rt.median_listing_price, 'realtor'
FROM realtor_zip rt
WHERE rt.median_listing_price IS NOT NULL AND rt.postal_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM _staging_price_zip sp
    WHERE sp.geo_id = rt.postal_code AND sp.price_date = DATE_TRUNC('month', rt.period_date)::date
  );

CREATE INDEX ON _staging_price_zip (geo_id, price_date);

\echo 'ZIP price rows:'
SELECT COUNT(*), COUNT(DISTINCT geo_id) AS zips FROM _staging_price_zip;
SELECT price_source, COUNT(*) FROM _staging_price_zip GROUP BY price_source;

-- 2d. RENT (ZORI + Census ACS fallback)
\echo 'Creating _staging_rent...'
DROP TABLE IF EXISTS _staging_rent;
CREATE TABLE _staging_rent (
  geo_type TEXT NOT NULL,
  geo_id TEXT NOT NULL,
  rent_date DATE NOT NULL,
  rent_value NUMERIC NOT NULL,
  rent_source TEXT NOT NULL DEFAULT 'zori'
);

-- ZORI data
INSERT INTO _staging_rent (geo_type, geo_id, rent_date, rent_value, rent_source)
SELECT 'metro', cbsa_code, DATE_TRUNC('month', period_date)::date, value, 'zori'
FROM zillow_metro WHERE metric_name = 'zori' AND value IS NOT NULL AND cbsa_code IS NOT NULL;

INSERT INTO _staging_rent (geo_type, geo_id, rent_date, rent_value, rent_source)
SELECT 'county', fips_code, DATE_TRUNC('month', period_date)::date, value, 'zori'
FROM zillow_county WHERE metric_name = 'zori' AND value IS NOT NULL AND fips_code IS NOT NULL;

INSERT INTO _staging_rent (geo_type, geo_id, rent_date, rent_value, rent_source)
SELECT 'zip', region_name, DATE_TRUNC('month', period_date)::date, value, 'zori'
FROM zillow_zip WHERE metric_name = 'zori' AND value IS NOT NULL AND region_name IS NOT NULL;

-- Census ACS fallback (expand yearly to monthly)
INSERT INTO _staging_rent (geo_type, geo_id, rent_date, rent_value, rent_source)
SELECT 'metro', c.cbsa_code,
  (MAKE_DATE(c.year, 1, 1) + (m.mon * INTERVAL '1 month'))::date,
  c.median_gross_rent, 'census_acs'
FROM census_metro c
CROSS JOIN generate_series(0, 11) AS m(mon)
WHERE c.median_gross_rent IS NOT NULL AND c.cbsa_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM _staging_rent sr
    WHERE sr.geo_type = 'metro' AND sr.geo_id = c.cbsa_code
      AND sr.rent_date = (MAKE_DATE(c.year, 1, 1) + (m.mon * INTERVAL '1 month'))::date
  );

INSERT INTO _staging_rent (geo_type, geo_id, rent_date, rent_value, rent_source)
SELECT 'county', c.fips_code,
  (MAKE_DATE(c.year, 1, 1) + (m.mon * INTERVAL '1 month'))::date,
  c.median_gross_rent, 'census_acs'
FROM census_county c
CROSS JOIN generate_series(0, 11) AS m(mon)
WHERE c.median_gross_rent IS NOT NULL AND c.fips_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM _staging_rent sr
    WHERE sr.geo_type = 'county' AND sr.geo_id = c.fips_code
      AND sr.rent_date = (MAKE_DATE(c.year, 1, 1) + (m.mon * INTERVAL '1 month'))::date
  );

INSERT INTO _staging_rent (geo_type, geo_id, rent_date, rent_value, rent_source)
SELECT 'zip', c.zcta,
  (MAKE_DATE(c.year, 1, 1) + (m.mon * INTERVAL '1 month'))::date,
  c.median_gross_rent, 'census_acs'
FROM census_zip c
CROSS JOIN generate_series(0, 11) AS m(mon)
WHERE c.median_gross_rent IS NOT NULL AND c.zcta IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM _staging_rent sr
    WHERE sr.geo_type = 'zip' AND sr.geo_id = c.zcta
      AND sr.rent_date = (MAKE_DATE(c.year, 1, 1) + (m.mon * INTERVAL '1 month'))::date
  );

CREATE INDEX ON _staging_rent (geo_type, geo_id, rent_date);

\echo 'Total rent rows by geo and source:'
SELECT geo_type, rent_source, COUNT(*) FROM _staging_rent GROUP BY geo_type, rent_source ORDER BY geo_type, rent_source;

-- 2e. BENCHMARKS - STATE
\echo 'Creating _staging_benchmark_state...'
DROP TABLE IF EXISTS _staging_benchmark_state;
CREATE TABLE _staging_benchmark_state AS
SELECT state_code, DATE_TRUNC('month', period_date)::date AS bench_date, metric_name, value
FROM zillow_state
WHERE metric_name IN ('zhvi', 'zori') AND value IS NOT NULL AND state_code IS NOT NULL;

CREATE INDEX ON _staging_benchmark_state (state_code, metric_name, bench_date);

\echo 'Staging tables created.'

-- =============================================================================
-- PHASE 3: UPDATE PRICE OUTCOMES (using mapping table for fast joins)
-- =============================================================================

\echo '=== PHASE 3: Updating price outcomes ==='

-- 3a. METRO PRICES
\echo 'Updating metro price outcomes...'
UPDATE propertyiq_backtest_outcomes o
SET
  outcome_6m_value = CASE
    WHEN p_start.price_value > 0 AND p_6m.price_value IS NOT NULL
    THEN ROUND(((p_6m.price_value - p_start.price_value) / p_start.price_value) * 100, 4)
  END,
  outcome_1y_value = CASE
    WHEN p_start.price_value > 0 AND p_1y.price_value IS NOT NULL
    THEN ROUND(((p_1y.price_value - p_start.price_value) / p_start.price_value) * 100, 4)
  END,
  outcome_3y_value = CASE
    WHEN p_start.price_value > 0 AND p_3y.price_value IS NOT NULL
    THEN ROUND((POW(p_3y.price_value / p_start.price_value, 1.0/3) - 1) * 100, 4)
  END,
  outcome_5y_value = CASE
    WHEN p_start.price_value > 0 AND p_5y.price_value IS NOT NULL
    THEN ROUND((POW(p_5y.price_value / p_start.price_value, 1.0/5) - 1) * 100, 4)
  END
FROM _staging_outcome_months om
JOIN _staging_price_metro p_start ON p_start.geo_id = om.geography_id AND p_start.price_date = om.score_month
LEFT JOIN _staging_price_metro p_6m  ON p_6m.geo_id  = om.geography_id AND p_6m.price_date  = (om.score_month + INTERVAL '6 months')::date
LEFT JOIN _staging_price_metro p_1y  ON p_1y.geo_id  = om.geography_id AND p_1y.price_date  = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_price_metro p_3y  ON p_3y.geo_id  = om.geography_id AND p_3y.price_date  = (om.score_month + INTERVAL '3 years')::date
LEFT JOIN _staging_price_metro p_5y  ON p_5y.geo_id  = om.geography_id AND p_5y.price_date  = (om.score_month + INTERVAL '5 years')::date
WHERE om.geography_type = 'metro'
  AND o.id = om.id;

-- 3b. COUNTY PRICES
\echo 'Updating county price outcomes...'
UPDATE propertyiq_backtest_outcomes o
SET
  outcome_6m_value = CASE
    WHEN p_start.price_value > 0 AND p_6m.price_value IS NOT NULL
    THEN ROUND(((p_6m.price_value - p_start.price_value) / p_start.price_value) * 100, 4)
  END,
  outcome_1y_value = CASE
    WHEN p_start.price_value > 0 AND p_1y.price_value IS NOT NULL
    THEN ROUND(((p_1y.price_value - p_start.price_value) / p_start.price_value) * 100, 4)
  END,
  outcome_3y_value = CASE
    WHEN p_start.price_value > 0 AND p_3y.price_value IS NOT NULL
    THEN ROUND((POW(p_3y.price_value / p_start.price_value, 1.0/3) - 1) * 100, 4)
  END,
  outcome_5y_value = CASE
    WHEN p_start.price_value > 0 AND p_5y.price_value IS NOT NULL
    THEN ROUND((POW(p_5y.price_value / p_start.price_value, 1.0/5) - 1) * 100, 4)
  END
FROM _staging_outcome_months om
JOIN _staging_price_county p_start ON p_start.geo_id = om.geography_id AND p_start.price_date = om.score_month
LEFT JOIN _staging_price_county p_6m  ON p_6m.geo_id  = om.geography_id AND p_6m.price_date  = (om.score_month + INTERVAL '6 months')::date
LEFT JOIN _staging_price_county p_1y  ON p_1y.geo_id  = om.geography_id AND p_1y.price_date  = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_price_county p_3y  ON p_3y.geo_id  = om.geography_id AND p_3y.price_date  = (om.score_month + INTERVAL '3 years')::date
LEFT JOIN _staging_price_county p_5y  ON p_5y.geo_id  = om.geography_id AND p_5y.price_date  = (om.score_month + INTERVAL '5 years')::date
WHERE om.geography_type = 'county'
  AND o.id = om.id;

-- 3c. ZIP PRICES (batch 1: pre-2022)
\echo 'Updating zip price outcomes (batch 1: pre-2022)...'
UPDATE propertyiq_backtest_outcomes o
SET
  outcome_6m_value = CASE
    WHEN p_start.price_value > 0 AND p_6m.price_value IS NOT NULL
    THEN ROUND(((p_6m.price_value - p_start.price_value) / p_start.price_value) * 100, 4)
  END,
  outcome_1y_value = CASE
    WHEN p_start.price_value > 0 AND p_1y.price_value IS NOT NULL
    THEN ROUND(((p_1y.price_value - p_start.price_value) / p_start.price_value) * 100, 4)
  END,
  outcome_3y_value = CASE
    WHEN p_start.price_value > 0 AND p_3y.price_value IS NOT NULL
    THEN ROUND((POW(p_3y.price_value / p_start.price_value, 1.0/3) - 1) * 100, 4)
  END,
  outcome_5y_value = CASE
    WHEN p_start.price_value > 0 AND p_5y.price_value IS NOT NULL
    THEN ROUND((POW(p_5y.price_value / p_start.price_value, 1.0/5) - 1) * 100, 4)
  END
FROM _staging_outcome_months om
JOIN _staging_price_zip p_start ON p_start.geo_id = om.geography_id AND p_start.price_date = om.score_month
LEFT JOIN _staging_price_zip p_6m  ON p_6m.geo_id  = om.geography_id AND p_6m.price_date  = (om.score_month + INTERVAL '6 months')::date
LEFT JOIN _staging_price_zip p_1y  ON p_1y.geo_id  = om.geography_id AND p_1y.price_date  = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_price_zip p_3y  ON p_3y.geo_id  = om.geography_id AND p_3y.price_date  = (om.score_month + INTERVAL '3 years')::date
LEFT JOIN _staging_price_zip p_5y  ON p_5y.geo_id  = om.geography_id AND p_5y.price_date  = (om.score_month + INTERVAL '5 years')::date
WHERE om.geography_type = 'zip'
  AND om.score_month < '2022-01-01'
  AND o.id = om.id;

-- 3d. ZIP PRICES (batch 2: 2022-2023)
\echo 'Updating zip price outcomes (batch 2: 2022-2023)...'
UPDATE propertyiq_backtest_outcomes o
SET
  outcome_6m_value = CASE
    WHEN p_start.price_value > 0 AND p_6m.price_value IS NOT NULL
    THEN ROUND(((p_6m.price_value - p_start.price_value) / p_start.price_value) * 100, 4)
  END,
  outcome_1y_value = CASE
    WHEN p_start.price_value > 0 AND p_1y.price_value IS NOT NULL
    THEN ROUND(((p_1y.price_value - p_start.price_value) / p_start.price_value) * 100, 4)
  END,
  outcome_3y_value = CASE
    WHEN p_start.price_value > 0 AND p_3y.price_value IS NOT NULL
    THEN ROUND((POW(p_3y.price_value / p_start.price_value, 1.0/3) - 1) * 100, 4)
  END,
  outcome_5y_value = CASE
    WHEN p_start.price_value > 0 AND p_5y.price_value IS NOT NULL
    THEN ROUND((POW(p_5y.price_value / p_start.price_value, 1.0/5) - 1) * 100, 4)
  END
FROM _staging_outcome_months om
JOIN _staging_price_zip p_start ON p_start.geo_id = om.geography_id AND p_start.price_date = om.score_month
LEFT JOIN _staging_price_zip p_6m  ON p_6m.geo_id  = om.geography_id AND p_6m.price_date  = (om.score_month + INTERVAL '6 months')::date
LEFT JOIN _staging_price_zip p_1y  ON p_1y.geo_id  = om.geography_id AND p_1y.price_date  = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_price_zip p_3y  ON p_3y.geo_id  = om.geography_id AND p_3y.price_date  = (om.score_month + INTERVAL '3 years')::date
LEFT JOIN _staging_price_zip p_5y  ON p_5y.geo_id  = om.geography_id AND p_5y.price_date  = (om.score_month + INTERVAL '5 years')::date
WHERE om.geography_type = 'zip'
  AND om.score_month >= '2022-01-01' AND om.score_month < '2024-01-01'
  AND o.id = om.id;

-- 3e. ZIP PRICES (batch 3: 2024+)
\echo 'Updating zip price outcomes (batch 3: 2024+)...'
UPDATE propertyiq_backtest_outcomes o
SET
  outcome_6m_value = CASE
    WHEN p_start.price_value > 0 AND p_6m.price_value IS NOT NULL
    THEN ROUND(((p_6m.price_value - p_start.price_value) / p_start.price_value) * 100, 4)
  END,
  outcome_1y_value = CASE
    WHEN p_start.price_value > 0 AND p_1y.price_value IS NOT NULL
    THEN ROUND(((p_1y.price_value - p_start.price_value) / p_start.price_value) * 100, 4)
  END,
  outcome_3y_value = CASE
    WHEN p_start.price_value > 0 AND p_3y.price_value IS NOT NULL
    THEN ROUND((POW(p_3y.price_value / p_start.price_value, 1.0/3) - 1) * 100, 4)
  END,
  outcome_5y_value = CASE
    WHEN p_start.price_value > 0 AND p_5y.price_value IS NOT NULL
    THEN ROUND((POW(p_5y.price_value / p_start.price_value, 1.0/5) - 1) * 100, 4)
  END
FROM _staging_outcome_months om
JOIN _staging_price_zip p_start ON p_start.geo_id = om.geography_id AND p_start.price_date = om.score_month
LEFT JOIN _staging_price_zip p_6m  ON p_6m.geo_id  = om.geography_id AND p_6m.price_date  = (om.score_month + INTERVAL '6 months')::date
LEFT JOIN _staging_price_zip p_1y  ON p_1y.geo_id  = om.geography_id AND p_1y.price_date  = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_price_zip p_3y  ON p_3y.geo_id  = om.geography_id AND p_3y.price_date  = (om.score_month + INTERVAL '3 years')::date
LEFT JOIN _staging_price_zip p_5y  ON p_5y.geo_id  = om.geography_id AND p_5y.price_date  = (om.score_month + INTERVAL '5 years')::date
WHERE om.geography_type = 'zip'
  AND om.score_month >= '2024-01-01'
  AND o.id = om.id;

\echo 'Price outcomes updated. Checking 6m coverage:'
SELECT geography_type, COUNT(outcome_6m_value) AS has_6m, COUNT(outcome_1y_value) AS has_1y, COUNT(*) AS total
FROM propertyiq_backtest_outcomes
GROUP BY geography_type ORDER BY geography_type;

-- =============================================================================
-- PHASE 4: UPDATE RENT OUTCOMES
-- =============================================================================

\echo '=== PHASE 4: Updating rent outcomes ==='

-- 4a. METRO RENT
\echo 'Updating metro rent outcomes...'
UPDATE propertyiq_backtest_outcomes o
SET
  rent_return_1y = CASE
    WHEN r_start.rent_value > 0 AND r_1y.rent_value IS NOT NULL
    THEN ROUND(((r_1y.rent_value - r_start.rent_value) / r_start.rent_value) * 100, 4)
  END,
  rent_return_3y_cagr = CASE
    WHEN r_start.rent_value > 0 AND r_3y.rent_value IS NOT NULL
    THEN ROUND((POW(r_3y.rent_value / r_start.rent_value, 1.0/3) - 1) * 100, 4)
  END
FROM _staging_outcome_months om
JOIN _staging_rent r_start ON r_start.geo_type = 'metro' AND r_start.geo_id = om.geography_id AND r_start.rent_date = om.score_month
LEFT JOIN _staging_rent r_1y ON r_1y.geo_type = 'metro' AND r_1y.geo_id = om.geography_id AND r_1y.rent_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_rent r_3y ON r_3y.geo_type = 'metro' AND r_3y.geo_id = om.geography_id AND r_3y.rent_date = (om.score_month + INTERVAL '3 years')::date
WHERE om.geography_type = 'metro'
  AND o.id = om.id;

-- 4b. COUNTY RENT
\echo 'Updating county rent outcomes...'
UPDATE propertyiq_backtest_outcomes o
SET
  rent_return_1y = CASE
    WHEN r_start.rent_value > 0 AND r_1y.rent_value IS NOT NULL
    THEN ROUND(((r_1y.rent_value - r_start.rent_value) / r_start.rent_value) * 100, 4)
  END,
  rent_return_3y_cagr = CASE
    WHEN r_start.rent_value > 0 AND r_3y.rent_value IS NOT NULL
    THEN ROUND((POW(r_3y.rent_value / r_start.rent_value, 1.0/3) - 1) * 100, 4)
  END
FROM _staging_outcome_months om
JOIN _staging_rent r_start ON r_start.geo_type = 'county' AND r_start.geo_id = om.geography_id AND r_start.rent_date = om.score_month
LEFT JOIN _staging_rent r_1y ON r_1y.geo_type = 'county' AND r_1y.geo_id = om.geography_id AND r_1y.rent_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_rent r_3y ON r_3y.geo_type = 'county' AND r_3y.geo_id = om.geography_id AND r_3y.rent_date = (om.score_month + INTERVAL '3 years')::date
WHERE om.geography_type = 'county'
  AND o.id = om.id;

-- 4c. ZIP RENT (batch 1: pre-2023)
\echo 'Updating zip rent outcomes (batch 1: pre-2023)...'
UPDATE propertyiq_backtest_outcomes o
SET
  rent_return_1y = CASE
    WHEN r_start.rent_value > 0 AND r_1y.rent_value IS NOT NULL
    THEN ROUND(((r_1y.rent_value - r_start.rent_value) / r_start.rent_value) * 100, 4)
  END,
  rent_return_3y_cagr = CASE
    WHEN r_start.rent_value > 0 AND r_3y.rent_value IS NOT NULL
    THEN ROUND((POW(r_3y.rent_value / r_start.rent_value, 1.0/3) - 1) * 100, 4)
  END
FROM _staging_outcome_months om
JOIN _staging_rent r_start ON r_start.geo_type = 'zip' AND r_start.geo_id = om.geography_id AND r_start.rent_date = om.score_month
LEFT JOIN _staging_rent r_1y ON r_1y.geo_type = 'zip' AND r_1y.geo_id = om.geography_id AND r_1y.rent_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_rent r_3y ON r_3y.geo_type = 'zip' AND r_3y.geo_id = om.geography_id AND r_3y.rent_date = (om.score_month + INTERVAL '3 years')::date
WHERE om.geography_type = 'zip'
  AND om.score_month < '2023-01-01'
  AND o.id = om.id;

-- 4d. ZIP RENT (batch 2: 2023+)
\echo 'Updating zip rent outcomes (batch 2: 2023+)...'
UPDATE propertyiq_backtest_outcomes o
SET
  rent_return_1y = CASE
    WHEN r_start.rent_value > 0 AND r_1y.rent_value IS NOT NULL
    THEN ROUND(((r_1y.rent_value - r_start.rent_value) / r_start.rent_value) * 100, 4)
  END,
  rent_return_3y_cagr = CASE
    WHEN r_start.rent_value > 0 AND r_3y.rent_value IS NOT NULL
    THEN ROUND((POW(r_3y.rent_value / r_start.rent_value, 1.0/3) - 1) * 100, 4)
  END
FROM _staging_outcome_months om
JOIN _staging_rent r_start ON r_start.geo_type = 'zip' AND r_start.geo_id = om.geography_id AND r_start.rent_date = om.score_month
LEFT JOIN _staging_rent r_1y ON r_1y.geo_type = 'zip' AND r_1y.geo_id = om.geography_id AND r_1y.rent_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_rent r_3y ON r_3y.geo_type = 'zip' AND r_3y.geo_id = om.geography_id AND r_3y.rent_date = (om.score_month + INTERVAL '3 years')::date
WHERE om.geography_type = 'zip'
  AND om.score_month >= '2023-01-01'
  AND o.id = om.id;

-- =============================================================================
-- PHASE 5: UPDATE BENCHMARKS (State ZHVI + ZORI)
-- =============================================================================

\echo '=== PHASE 5: Updating benchmarks ==='

-- 5a. STATE ZHVI BENCHMARKS
\echo 'Updating state ZHVI benchmarks...'
UPDATE propertyiq_backtest_outcomes o
SET
  state_return_1y = CASE
    WHEN bs.value > 0 AND bs_1y.value IS NOT NULL
    THEN ROUND(((bs_1y.value - bs.value) / bs.value) * 100, 4)
  END,
  state_return_3y_cagr = CASE
    WHEN bs.value > 0 AND bs_3y.value IS NOT NULL
    THEN ROUND((POW(bs_3y.value / bs.value, 1.0/3) - 1) * 100, 4)
  END,
  state_return_5y_cagr = CASE
    WHEN bs.value > 0 AND bs_5y.value IS NOT NULL
    THEN ROUND((POW(bs_5y.value / bs.value, 1.0/5) - 1) * 100, 4)
  END
FROM _staging_outcome_months om
JOIN _staging_benchmark_state bs ON bs.state_code = om.state_code AND bs.metric_name = 'zhvi' AND bs.bench_date = om.score_month
LEFT JOIN _staging_benchmark_state bs_1y ON bs_1y.state_code = om.state_code AND bs_1y.metric_name = 'zhvi' AND bs_1y.bench_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_benchmark_state bs_3y ON bs_3y.state_code = om.state_code AND bs_3y.metric_name = 'zhvi' AND bs_3y.bench_date = (om.score_month + INTERVAL '3 years')::date
LEFT JOIN _staging_benchmark_state bs_5y ON bs_5y.state_code = om.state_code AND bs_5y.metric_name = 'zhvi' AND bs_5y.bench_date = (om.score_month + INTERVAL '5 years')::date
WHERE om.state_code IS NOT NULL
  AND o.id = om.id;

-- 5b. STATE ZORI BENCHMARKS
\echo 'Updating state ZORI benchmarks...'
UPDATE propertyiq_backtest_outcomes o
SET
  state_rent_return_1y = CASE
    WHEN bs.value > 0 AND bs_1y.value IS NOT NULL
    THEN ROUND(((bs_1y.value - bs.value) / bs.value) * 100, 4)
  END,
  state_rent_return_3y_cagr = CASE
    WHEN bs.value > 0 AND bs_3y.value IS NOT NULL
    THEN ROUND((POW(bs_3y.value / bs.value, 1.0/3) - 1) * 100, 4)
  END
FROM _staging_outcome_months om
JOIN _staging_benchmark_state bs ON bs.state_code = om.state_code AND bs.metric_name = 'zori' AND bs.bench_date = om.score_month
LEFT JOIN _staging_benchmark_state bs_1y ON bs_1y.state_code = om.state_code AND bs_1y.metric_name = 'zori' AND bs_1y.bench_date = (om.score_month + INTERVAL '1 year')::date
LEFT JOIN _staging_benchmark_state bs_3y ON bs_3y.state_code = om.state_code AND bs_3y.metric_name = 'zori' AND bs_3y.bench_date = (om.score_month + INTERVAL '3 years')::date
WHERE om.state_code IS NOT NULL
  AND o.id = om.id;

-- NOTE: National benchmarks skipped - no 'United States' row in zillow_state.
-- Will need to be populated via a separate weighted-average calculation.

-- =============================================================================
-- PHASE 6: EXCESS RETURNS + VERIFICATION + CLEANUP
-- =============================================================================

\echo '=== PHASE 6: Excess returns, verification, cleanup ==='

-- 6a. EXCESS RETURNS
\echo 'Calculating excess returns...'
UPDATE propertyiq_backtest_outcomes
SET
  excess_vs_state_1y   = CASE WHEN outcome_1y_value IS NOT NULL AND state_return_1y IS NOT NULL THEN outcome_1y_value - state_return_1y END,
  excess_vs_state_3y   = CASE WHEN outcome_3y_value IS NOT NULL AND state_return_3y_cagr IS NOT NULL THEN outcome_3y_value - state_return_3y_cagr END,
  excess_vs_state_5y   = CASE WHEN outcome_5y_value IS NOT NULL AND state_return_5y_cagr IS NOT NULL THEN outcome_5y_value - state_return_5y_cagr END,
  excess_vs_national_1y = CASE WHEN outcome_1y_value IS NOT NULL AND national_return_1y IS NOT NULL THEN outcome_1y_value - national_return_1y END,
  excess_vs_national_3y = CASE WHEN outcome_3y_value IS NOT NULL AND national_return_3y_cagr IS NOT NULL THEN outcome_3y_value - national_return_3y_cagr END,
  excess_vs_national_5y = CASE WHEN outcome_5y_value IS NOT NULL AND national_return_5y_cagr IS NOT NULL THEN outcome_5y_value - national_return_5y_cagr END
WHERE outcome_1y_value IS NOT NULL
  OR state_return_1y IS NOT NULL
  OR national_return_1y IS NOT NULL;

-- 6b. FINAL VERIFICATION
\echo '=== FINAL VERIFICATION ==='
SELECT
  geography_type,
  COUNT(*) AS total_rows,
  COUNT(state_code) AS has_state_code,
  COUNT(outcome_6m_value) AS has_6m,
  COUNT(outcome_1y_value) AS has_1y,
  COUNT(outcome_3y_value) AS has_3y,
  COUNT(outcome_5y_value) AS has_5y,
  COUNT(rent_return_1y) AS has_rent_1y,
  COUNT(rent_return_3y_cagr) AS has_rent_3y,
  COUNT(state_return_1y) AS has_state_1y,
  COUNT(state_return_3y_cagr) AS has_state_3y,
  COUNT(state_return_5y_cagr) AS has_state_5y,
  COUNT(national_return_1y) AS has_national_1y,
  COUNT(national_rent_return_1y) AS has_national_rent_1y,
  COUNT(state_rent_return_1y) AS has_state_rent_1y,
  COUNT(state_rent_return_3y_cagr) AS has_state_rent_3y,
  COUNT(excess_vs_national_1y) AS has_excess_nat_1y,
  COUNT(excess_vs_state_1y) AS has_excess_state_1y
FROM propertyiq_backtest_outcomes
GROUP BY geography_type
ORDER BY geography_type;

-- Spot check: Dallas metro (CBSA 19100)
\echo 'Spot check - Dallas metro (CBSA 19100):'
SELECT geography_id, score_date, score_value,
  outcome_6m_value, outcome_1y_value, outcome_3y_value, outcome_5y_value,
  rent_return_1y, rent_return_3y_cagr,
  state_return_1y, state_rent_return_1y,
  excess_vs_state_1y
FROM propertyiq_backtest_outcomes
WHERE geography_id = '19100' AND geography_type = 'metro'
ORDER BY score_date DESC
LIMIT 5;

-- 6c. CLEANUP
\echo 'Cleaning up staging tables...'
DROP TABLE IF EXISTS _staging_price_metro;
DROP TABLE IF EXISTS _staging_price_county;
DROP TABLE IF EXISTS _staging_price_zip;
DROP TABLE IF EXISTS _staging_rent;
DROP TABLE IF EXISTS _staging_benchmark_state;
DROP TABLE IF EXISTS _staging_outcome_months;
DROP TABLE IF EXISTS _staging_state_fips_map;
DROP TABLE IF EXISTS _staging_cbsa_state_map;
DROP TABLE IF EXISTS _staging_zip_state_map;
DROP INDEX IF EXISTS idx_backtest_null_state_code;

\echo '=== DONE ==='
