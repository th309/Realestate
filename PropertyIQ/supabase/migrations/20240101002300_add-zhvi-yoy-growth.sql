-- Migration 027: Add Year-over-Year Growth Column to zillow_zhvi
-- This adds a yoy_growth column that stores the percentage change from 12 months ago
--
-- NOTE: This migration only adds the column and index.
-- Use the TypeScript script to populate the data:
--   npx tsx scripts/calculate-zhvi-yoy-growth.ts

-- Step 1: Add the column
ALTER TABLE zillow_zhvi
ADD COLUMN IF NOT EXISTS yoy_growth DECIMAL(10, 4);

-- Step 2: Create index for faster lookups (used when calculating YoY)
CREATE INDEX IF NOT EXISTS idx_zillow_zhvi_yoy_lookup
ON zillow_zhvi(region_id, property_type, tier, geography, date);

-- Step 3: Add comment
COMMENT ON COLUMN zillow_zhvi.yoy_growth IS 'Year-over-year percentage growth compared to same month 12 months prior';
