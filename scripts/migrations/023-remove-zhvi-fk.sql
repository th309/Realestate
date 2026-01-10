-- Migration: Remove foreign key constraint from zillow_zhvi
-- This allows zillow_zhvi to store data independently without requiring
-- matching entries in the markets table. The geography_crosswalk table
-- serves as the integration layer for all geographic data.

-- Remove the foreign key constraint
ALTER TABLE zillow_zhvi DROP CONSTRAINT IF EXISTS zillow_zhvi_region_id_fkey;

-- Verify the constraint was removed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'zillow_zhvi_region_id_fkey'
    AND table_name = 'zillow_zhvi'
  ) THEN
    RAISE NOTICE 'FK constraint zillow_zhvi_region_id_fkey successfully removed';
  ELSE
    RAISE NOTICE 'FK constraint still exists';
  END IF;
END $$;

-- Add a comment explaining the architecture
COMMENT ON TABLE zillow_zhvi IS 'Zillow Home Value Index data. Uses native region IDs (FIPS for counties, state names for states). Join with geography_crosswalk for metadata lookups.';
