-- Migration 115: Backfill fips_code in redfin_county using geography_crosswalk
--
-- Context: The redfin_county table has ~397K rows with fips_code = NULL.
-- The column exists and is indexed, but the import pipeline never populated it.
-- This blocks the backtest outcome generator which queries by fips_code.
--
-- Strategy: Join on county_name + state_code using the geography_crosswalk table.
-- Two passes handle name format differences:
--   1. Direct match (e.g., "Autauga County" = "Autauga County")
--   2. Redfin name without " County" suffix matches crosswalk with it

-- Pass 1: Direct county name match
UPDATE redfin_county rc
SET fips_code = gc.county_fips
FROM (
  SELECT DISTINCT county_name, state_abbrev, county_fips
  FROM geography_crosswalk
  WHERE county_fips IS NOT NULL
    AND county_name IS NOT NULL
) gc
WHERE LOWER(TRIM(rc.county_name)) = LOWER(TRIM(gc.county_name))
  AND rc.state_code = gc.state_abbrev
  AND rc.fips_code IS NULL;

-- Pass 2: Redfin uses bare name (e.g., "Autauga"), crosswalk has "Autauga County"
UPDATE redfin_county rc
SET fips_code = gc.county_fips
FROM (
  SELECT DISTINCT county_name, state_abbrev, county_fips
  FROM geography_crosswalk
  WHERE county_fips IS NOT NULL
    AND county_name IS NOT NULL
) gc
WHERE LOWER(TRIM(rc.county_name)) || ' county' = LOWER(TRIM(gc.county_name))
  AND rc.state_code = gc.state_abbrev
  AND rc.fips_code IS NULL;

-- Pass 3: Redfin has "X County", crosswalk has bare "X" (reverse of pass 2)
UPDATE redfin_county rc
SET fips_code = gc.county_fips
FROM (
  SELECT DISTINCT county_name, state_abbrev, county_fips
  FROM geography_crosswalk
  WHERE county_fips IS NOT NULL
    AND county_name IS NOT NULL
) gc
WHERE LOWER(TRIM(REGEXP_REPLACE(rc.county_name, '\s+(County|Parish|Borough|Census Area|Municipality)$', '', 'i')))
    = LOWER(TRIM(REGEXP_REPLACE(gc.county_name, '\s+(County|Parish|Borough|Census Area|Municipality)$', '', 'i')))
  AND rc.state_code = gc.state_abbrev
  AND rc.fips_code IS NULL;

-- Verification queries (run manually after migration):
-- SELECT COUNT(*) AS populated FROM redfin_county WHERE fips_code IS NOT NULL;
-- SELECT COUNT(*) AS still_null FROM redfin_county WHERE fips_code IS NULL;
-- SELECT DISTINCT county_name, state_code FROM redfin_county WHERE fips_code IS NULL ORDER BY state_code, county_name;
