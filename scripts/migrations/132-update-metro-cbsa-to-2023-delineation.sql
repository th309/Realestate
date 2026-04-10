-- Migration 132: Update metro CBSA codes to 2023 Census delineation
--
-- The 2023 Census Bureau delineation updated CBSA codes for ~100 metros.
-- PropertyIQ v4 scores (score_type='propertyiq') already use the 2023 codes
-- (sourced from tiger_cbsa.geoid via Redfin data). Legacy scores and other
-- metro tables still use the older codes.
--
-- This migration:
-- 1. Builds a crosswalk from tiger_cbsa (authoritative 2023 codes)
-- 2. Updates propertyiq_scores_v2 (legacy scores) to use 2023 codes
-- 3. Updates zillow_metro, realtor_metro, economic_metro, calculated_metrics
-- 4. Updates geography_crosswalk metro entries

-- ============================================================================
-- 1. Build crosswalk: old CBSA code -> new CBSA code (2023)
-- ============================================================================
-- We identify old codes by finding metros in propertyiq_scores_v2 whose
-- location_id does NOT exist in tiger_cbsa.geoid, then fuzzy-match by name
-- to find the correct 2023 geoid.

CREATE TEMP TABLE cbsa_crosswalk AS
WITH old_codes AS (
    -- Metros in scores table that are NOT in tiger_cbsa (i.e., old codes)
    SELECT DISTINCT s.location_id AS old_cbsa, s.location_name
    FROM propertyiq_scores_v2 s
    WHERE s.geography = 'metro'
      AND NOT EXISTS (
          SELECT 1 FROM tiger_cbsa t WHERE t.geoid = s.location_id
      )
),
matched AS (
    SELECT
        o.old_cbsa,
        o.location_name AS old_name,
        t.geoid AS new_cbsa,
        t.name AS tiger_name,
        -- Match on the first word of the metro name (city name)
        similarity(
            split_part(o.location_name, ',', 1),
            split_part(t.name, ',', 1)
        ) AS sim
    FROM old_codes o
    CROSS JOIN tiger_cbsa t
    WHERE
        -- Only consider CBSAs (not CSAs or other types)
        t.lsad IN ('M1', 'M2', 'M3', 'Metro')
        -- First-word similarity filter
        AND similarity(
            split_part(o.location_name, ',', 1),
            split_part(t.name, ',', 1)
        ) > 0.3
)
SELECT DISTINCT ON (old_cbsa)
    old_cbsa,
    new_cbsa,
    old_name,
    tiger_name
FROM matched
WHERE old_cbsa != new_cbsa
ORDER BY old_cbsa, sim DESC;

-- Show what will be updated
DO $$
DECLARE
    r RECORD;
    cnt INT;
BEGIN
    SELECT count(*) INTO cnt FROM cbsa_crosswalk;
    RAISE NOTICE 'Found % CBSA codes to update', cnt;
    FOR r IN SELECT * FROM cbsa_crosswalk ORDER BY old_cbsa LIMIT 20 LOOP
        RAISE NOTICE '  % -> % (%)', r.old_cbsa, r.new_cbsa, r.old_name;
    END LOOP;
END $$;

-- ============================================================================
-- 2. Update propertyiq_scores_v2 (legacy scores with old codes)
-- ============================================================================
UPDATE propertyiq_scores_v2 s
SET location_id = c.new_cbsa
FROM cbsa_crosswalk c
WHERE s.geography = 'metro'
  AND s.location_id = c.old_cbsa;

-- ============================================================================
-- 3. Update zillow_metro
-- ============================================================================
UPDATE zillow_metro z
SET cbsa_code = c.new_cbsa
FROM cbsa_crosswalk c
WHERE z.cbsa_code = c.old_cbsa;

-- ============================================================================
-- 4. Update realtor_metro
-- ============================================================================
UPDATE realtor_metro r
SET cbsa_code = c.new_cbsa
FROM cbsa_crosswalk c
WHERE r.cbsa_code = c.old_cbsa;

-- ============================================================================
-- 5. Update economic_metro
-- ============================================================================
UPDATE economic_metro e
SET cbsa_code = c.new_cbsa
FROM cbsa_crosswalk c
WHERE e.cbsa_code = c.old_cbsa;

-- ============================================================================
-- 6. Update geography_crosswalk (metro entries)
-- ============================================================================
UPDATE geography_crosswalk g
SET metro_cbsa = c.new_cbsa
FROM cbsa_crosswalk c
WHERE g.metro_cbsa = c.old_cbsa;

-- ============================================================================
-- 7. Update calculated_metrics (metro geography)
-- ============================================================================
UPDATE calculated_metrics cm
SET region_id = c.new_cbsa
FROM cbsa_crosswalk c
WHERE cm.geography_level = 'metro'
  AND cm.region_id = c.old_cbsa;

-- ============================================================================
-- 8. Verify: no orphaned scores (every metro location_id should be in tiger_cbsa)
-- ============================================================================
DO $$
DECLARE
    orphan_count INT;
BEGIN
    SELECT count(DISTINCT location_id) INTO orphan_count
    FROM propertyiq_scores_v2 s
    WHERE s.geography = 'metro'
      AND NOT EXISTS (
          SELECT 1 FROM tiger_cbsa t WHERE t.geoid = s.location_id
      );
    IF orphan_count > 0 THEN
        RAISE WARNING '% metro location_ids still not in tiger_cbsa after migration', orphan_count;
    ELSE
        RAISE NOTICE 'All metro location_ids now match tiger_cbsa. Migration complete.';
    END IF;
END $$;

DROP TABLE cbsa_crosswalk;
