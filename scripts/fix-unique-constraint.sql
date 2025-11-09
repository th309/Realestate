DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT DISTINCT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'market_time_series'::regclass
    AND contype = 'u'
    AND (conname LIKE '%region_id_date_metric_name%' OR conname LIKE '%property_type%' OR conname LIKE '%tier%')
    LIMIT 1;
    
    IF constraint_name IS NOT NULL THEN
        ALTER TABLE market_time_series DROP CONSTRAINT IF EXISTS market_time_series_region_id_date_metric_name_data_sou_key CASCADE;
        ALTER TABLE market_time_series DROP CONSTRAINT IF EXISTS market_time_series_unique CASCADE;
        EXECUTE format('ALTER TABLE market_time_series DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No old constraint found on parent table';
    END IF;
    
    FOR constraint_name IN
        SELECT DISTINCT conname
        FROM pg_constraint
        WHERE conrelid IN (
            SELECT oid FROM pg_class 
            WHERE relname LIKE 'market_time_series_%'
            AND relkind = 'r'
            AND relname != 'market_time_series'
        )
        AND contype = 'u'
        AND (conname LIKE '%region_id_date_metric_name%' OR conname LIKE '%property_type%' OR conname LIKE '%tier%')
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE market_time_series DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_name);
            RAISE NOTICE 'Attempted to drop constraint: %', constraint_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop % (may be inherited): %', constraint_name, SQLERRM;
        END;
    END LOOP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'market_time_series'::regclass
        AND conname = 'market_time_series_unique'
    ) THEN
        BEGIN
            ALTER TABLE market_time_series
            ADD CONSTRAINT market_time_series_unique 
            UNIQUE (region_id, date, metric_name, data_source, attributes);
            RAISE NOTICE 'Added new unique constraint with JSONB';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error creating constraint: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;
