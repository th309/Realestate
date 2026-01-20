-- Migration 058: Backfill null total_units in permits tables
-- Calculates total_units from component fields: sf + duplex + small_multi + large_multi
-- This ensures 0 is stored instead of null when all components are 0

-- Backfill permits_county
UPDATE permits_county
SET total_units = COALESCE(sf_units, 0) + COALESCE(duplex_units, 0) + COALESCE(small_multi_units, 0) + COALESCE(large_multi_units, 0)
WHERE total_units IS NULL;

-- Backfill permits_state
UPDATE permits_state
SET total_units = COALESCE(sf_units, 0) + COALESCE(duplex_units, 0) + COALESCE(small_multi_units, 0) + COALESCE(large_multi_units, 0)
WHERE total_units IS NULL;

-- Also backfill total_buildings if null
UPDATE permits_county
SET total_buildings = COALESCE(sf_buildings, 0) + COALESCE(duplex_buildings, 0) + COALESCE(small_multi_buildings, 0) + COALESCE(large_multi_buildings, 0)
WHERE total_buildings IS NULL;

UPDATE permits_state
SET total_buildings = COALESCE(sf_buildings, 0) + COALESCE(duplex_buildings, 0) + COALESCE(small_multi_buildings, 0) + COALESCE(large_multi_buildings, 0)
WHERE total_buildings IS NULL;

-- Backfill total_value if null
UPDATE permits_county
SET total_value = COALESCE(sf_value, 0) + COALESCE(duplex_value, 0) + COALESCE(small_multi_value, 0) + COALESCE(large_multi_value, 0)
WHERE total_value IS NULL;

UPDATE permits_state
SET total_value = COALESCE(sf_value, 0) + COALESCE(duplex_value, 0) + COALESCE(small_multi_value, 0) + COALESCE(large_multi_value, 0)
WHERE total_value IS NULL;
