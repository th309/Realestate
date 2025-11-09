DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname, conrelid::regclass::text as table_name
        FROM pg_constraint
        WHERE conrelid IN (
            SELECT oid FROM pg_class 
            WHERE relname LIKE 'market_time_series%'
            AND relkind = 'r'
        )
        AND contype = 'u'
        AND conname LIKE '%region_id_date_metric_name%'
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I CASCADE', 
            constraint_record.table_name, 
            constraint_record.conname);
        RAISE NOTICE 'Dropped constraint % from table %', constraint_record.conname, constraint_record.table_name;
    END LOOP;
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

