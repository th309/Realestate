-- ============================================================================
-- Migration: Convert Zillow-specific fields to JSONB attributes
-- Purpose: Make schema flexible for all data sources (FRED, Census, BLS, etc.)
-- Date: 2025-01-09
-- ============================================================================

-- Step 1: Add attributes JSONB column (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'market_time_series' 
        AND column_name = 'attributes'
    ) THEN
        ALTER TABLE market_time_series 
        ADD COLUMN attributes JSONB DEFAULT '{}';
        
        RAISE NOTICE 'Added attributes JSONB column';
    ELSE
        RAISE NOTICE 'attributes column already exists';
    END IF;
END $$;

-- Step 2: Migrate existing Zillow data to JSONB attributes
-- Move property_type and tier into attributes JSONB
UPDATE market_time_series
SET attributes = jsonb_build_object(
    CASE WHEN property_type IS NOT NULL THEN 'property_type' ELSE NULL END,
    property_type,
    CASE WHEN tier IS NOT NULL THEN 'tier' ELSE NULL END,
    tier
)
WHERE (property_type IS NOT NULL OR tier IS NOT NULL)
AND attributes = '{}'::jsonb;

-- Clean up: Remove NULL keys from JSONB
UPDATE market_time_series
SET attributes = attributes - 'null'
WHERE attributes ? 'null';

-- Step 3: Drop the old unique constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'market_time_series_region_id_date_metric_name_data_sou_key'
    ) THEN
        ALTER TABLE market_time_series 
        DROP CONSTRAINT market_time_series_region_id_date_metric_name_data_sou_key;
        
        RAISE NOTICE 'Dropped old unique constraint';
    ELSE
        RAISE NOTICE 'Old unique constraint does not exist';
    END IF;
END $$;

-- Step 4: Create new unique constraint with JSONB attributes
-- Note: We need to handle this per partition since it's a partitioned table
-- For partitioned tables, we add the constraint to the parent and it applies to all partitions

DO $$
BEGIN
    -- Try to add the constraint, ignore if it already exists
    BEGIN
        ALTER TABLE market_time_series
        ADD CONSTRAINT market_time_series_unique 
        UNIQUE (region_id, date, metric_name, data_source, attributes);
        
        RAISE NOTICE 'Added new unique constraint with JSONB';
    EXCEPTION WHEN duplicate_table THEN
        RAISE NOTICE 'Unique constraint already exists';
    END;
END $$;

-- Step 5: Create GIN index on JSONB attributes for efficient queries
CREATE INDEX IF NOT EXISTS idx_time_series_attributes 
ON market_time_series USING gin(attributes);

-- Step 6: Verify migration
DO $$
DECLARE
    migrated_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM market_time_series;
    SELECT COUNT(*) INTO migrated_count 
    FROM market_time_series 
    WHERE attributes != '{}'::jsonb;
    
    RAISE NOTICE 'Migration complete!';
    RAISE NOTICE 'Total records: %', total_count;
    RAISE NOTICE 'Records with attributes: %', migrated_count;
END $$;

-- Step 7: Keep property_type and tier columns for now (we'll drop them later)
-- This allows for a gradual migration and rollback if needed
-- We'll drop them in a separate migration after verifying everything works

COMMENT ON COLUMN market_time_series.attributes IS 
'Source-specific attributes as JSONB. Zillow: {property_type, tier}. Census: {survey_type, year}. FRED: {series_id}. Others: {} or source-specific fields.';

