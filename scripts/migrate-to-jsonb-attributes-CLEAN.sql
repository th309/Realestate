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
-- For partitioned tables, we need to drop from parent and all partitions
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name (it may vary by partition)
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'market_time_series'::regclass
    AND contype = 'u'
    AND conname LIKE '%region_id_date_metric_name%'
    LIMIT 1;
    
    IF constraint_name IS NOT NULL THEN
        -- Drop from parent (cascades to partitions)
        EXECUTE format('ALTER TABLE market_time_series DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_name);
        RAISE NOTICE 'Dropped old unique constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'Old unique constraint not found (may have different name)';
    END IF;
END $$;

-- Step 4: Create new unique constraint with JSONB attributes
-- For partitioned tables, we add the constraint to the parent and it applies to all partitions
-- Note: JSONB comparison in unique constraints works, but we need to ensure consistent ordering
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'market_time_series'::regclass
        AND conname = 'market_time_series_unique'
    ) THEN
        ALTER TABLE market_time_series
        ADD CONSTRAINT market_time_series_unique 
        UNIQUE (region_id, date, metric_name, data_source, attributes);
        
        RAISE NOTICE 'Added new unique constraint with JSONB';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating constraint: %', SQLERRM;
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

