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

UPDATE market_time_series
SET attributes = jsonb_build_object(
    CASE WHEN property_type IS NOT NULL THEN 'property_type' ELSE NULL END,
    property_type,
    CASE WHEN tier IS NOT NULL THEN 'tier' ELSE NULL END,
    tier
)
WHERE (property_type IS NOT NULL OR tier IS NOT NULL)
AND attributes = '{}'::jsonb;

UPDATE market_time_series
SET attributes = attributes - 'null'
WHERE attributes ? 'null';

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'market_time_series'::regclass
    AND contype = 'u'
    AND conname LIKE '%region_id_date_metric_name%'
    LIMIT 1;
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE market_time_series DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_name);
        RAISE NOTICE 'Dropped old unique constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'Old unique constraint not found';
    END IF;
END $$;

DO $$
BEGIN
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

CREATE INDEX IF NOT EXISTS idx_time_series_attributes 
ON market_time_series USING gin(attributes);

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
