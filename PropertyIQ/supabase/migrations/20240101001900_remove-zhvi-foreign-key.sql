-- Migration: Remove foreign key constraint from zillow_zhvi
-- Purpose: Allow standardized geographic codes (FIPS, CBSA) instead of markets.region_id
-- Date: 2026-01-10

-- The zillow_zhvi table uses standardized geographic codes:
-- - State: State name
-- - Metro: CBSA code (5-digit)
-- - County: FIPS code (5-digit)
-- - Zip: ZIP code

-- Remove the foreign key constraint
ALTER TABLE zillow_zhvi DROP CONSTRAINT IF EXISTS zillow_zhvi_region_id_fkey;

-- Verify
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conrelid = 'zillow_zhvi'::regclass AND contype = 'f';
