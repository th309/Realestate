DO $$
DECLARE
    unmigrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unmigrated_count
    FROM market_time_series
    WHERE (property_type IS NOT NULL OR tier IS NOT NULL)
    AND (attributes->>'property_type' IS NULL AND attributes->>'tier' IS NULL);
    
    IF unmigrated_count > 0 THEN
        RAISE EXCEPTION 'Found % unmigrated records. Migration incomplete!', unmigrated_count;
    ELSE
        RAISE NOTICE 'All records migrated successfully. Safe to drop columns.';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'market_time_series' 
        AND column_name = 'property_type'
    ) THEN
        ALTER TABLE market_time_series DROP COLUMN property_type;
        RAISE NOTICE 'Dropped property_type column';
    ELSE
        RAISE NOTICE 'property_type column does not exist';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'market_time_series' 
        AND column_name = 'tier'
    ) THEN
        ALTER TABLE market_time_series DROP COLUMN tier;
        RAISE NOTICE 'Dropped tier column';
    ELSE
        RAISE NOTICE 'tier column does not exist';
    END IF;
END $$;
