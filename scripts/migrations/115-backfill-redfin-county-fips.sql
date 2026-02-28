-- Migration 115: Backfill fips_code in redfin_county using geography_crosswalk
--
-- Context: The redfin_county table has ~1.165M rows with fips_code = NULL.
-- The column exists and is indexed, but the import pipeline never populated it.
-- This blocks the backtest outcome generator which queries by fips_code.
--
-- Redfin county_name format: "Autauga County, AL" (includes state suffix)
-- Crosswalk county_name format: "Autauga County" (no state suffix)
--
-- Strategy: Join on county_name + state_code using the geography_crosswalk table.
-- Two passes handle name format differences.

-- Pass 1: Direct match — concatenate crosswalk name + state to match Redfin format
UPDATE redfin_county rc
SET fips_code = gc.county_fips
FROM (
  SELECT DISTINCT county_name, state_abbrev, county_fips
  FROM geography_crosswalk
  WHERE county_fips IS NOT NULL
    AND county_name IS NOT NULL
) gc
WHERE LOWER(TRIM(rc.county_name)) = LOWER(TRIM(gc.county_name || ', ' || gc.state_abbrev))
  AND rc.state_code = gc.state_abbrev
  AND rc.fips_code IS NULL;

-- Pass 2: Stripped suffix match (handles Parish, Borough, Census Area, etc.)
-- Strips ", ST" from Redfin name, strips "County/Parish/etc" from crosswalk name
UPDATE redfin_county rc
SET fips_code = gc.county_fips
FROM (
  SELECT DISTINCT county_name, state_abbrev, county_fips
  FROM geography_crosswalk
  WHERE county_fips IS NOT NULL
    AND county_name IS NOT NULL
) gc
WHERE LOWER(TRIM(REGEXP_REPLACE(rc.county_name, ',\s*[A-Z]{2}\s*$', '', 'i')))
    = LOWER(TRIM(REGEXP_REPLACE(gc.county_name, '\s+(County|Parish|Borough|Census Area|Municipality)$', '', 'i')))
  AND rc.state_code = gc.state_abbrev
  AND rc.fips_code IS NULL;

-- Verification queries (run after migration):
-- SELECT COUNT(*) AS populated FROM redfin_county WHERE fips_code IS NOT NULL;
-- SELECT COUNT(*) AS still_null FROM redfin_county WHERE fips_code IS NULL;
-- SELECT DISTINCT county_name, state_code FROM redfin_county WHERE fips_code IS NULL ORDER BY state_code, county_name;
