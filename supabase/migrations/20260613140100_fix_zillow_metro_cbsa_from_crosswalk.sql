-- Data correction: zillow_metro.cbsa_code had two failure modes that corrupted
-- metro PropertyIQ scores:
--   1. The 2026-05-23 ZHVI ingest left cbsa_code NULL for new months (2026-02+),
--      dropping those metros from scoring (momentum features went null).
--   2. Two unrelated Zillow regions were mapped to the same CBSA (e.g. "Helena, MT"
--      and "Helena, AR" both -> 25740; "Atlantic City, NJ" and "Ocean City, NJ"
--      both -> 12100). The duplicate produced wildly different ZHVI per CBSA, and
--      because the score signal is a sum of cross-sectional z-scores, those
--      outliers re-weighted the ranking for ALL metros non-deterministically.
--
-- Authoritative fix: re-derive cbsa_code from zillow_metro_crosswalk, choosing one
-- canonical region per CBSA (the region whose name matches the CBSA title; ties
-- broken by lowest region_id), and NULLing cbsa_code for every non-canonical or
-- non-crosswalk region so each CBSA maps to exactly one region.
--
-- NOTE: the recurring root cause is the ingestion pipeline not applying the
-- crosswalk for new months. This migration corrects existing data; the ingest
-- script must also be fixed so future months don't regress.

CREATE TEMP TABLE _canon_cbsa AS
  SELECT zillow_region_id AS region_id, cbsa_code
  FROM (
    SELECT zillow_region_id, cbsa_code,
      row_number() OVER (
        PARTITION BY cbsa_code
        ORDER BY
          CASE WHEN cbsa_title ILIKE split_part(zillow_region_name, ',', 1) || '%'
               THEN 0 ELSE 1 END,
          zillow_region_id
      ) AS rn
    FROM zillow_metro_crosswalk
  ) t
  WHERE rn = 1;

-- NULL cbsa_code on any region that is not the canonical owner of its CBSA.
UPDATE zillow_metro z
SET cbsa_code = NULL
WHERE z.cbsa_code IS NOT NULL
  AND z.region_id NOT IN (SELECT region_id FROM _canon_cbsa);

-- Ensure canonical regions carry the correct CBSA from the crosswalk.
UPDATE zillow_metro z
SET cbsa_code = c.cbsa_code
FROM _canon_cbsa c
WHERE z.region_id = c.region_id
  AND z.cbsa_code IS DISTINCT FROM c.cbsa_code;

DROP TABLE _canon_cbsa;
