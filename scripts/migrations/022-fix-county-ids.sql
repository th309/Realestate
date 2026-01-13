-- Migration: Fix county IDs to use FIPS codes instead of Zillow RegionIDs
-- Run this in Supabase SQL Editor

-- Step 1: Delete all existing county data (using Zillow RegionIDs)
DELETE FROM zillow_zhvi WHERE geography = 'County';

-- Verify deletion
SELECT COUNT(*) as remaining_county_records
FROM zillow_zhvi
WHERE geography = 'County';

-- After running this, re-run the county import script:
-- npx tsx scripts/zillow-import/import-county.ts --force
