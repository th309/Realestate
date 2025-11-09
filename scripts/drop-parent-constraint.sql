DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname, pg_get_constraintdef(oid) as def
        FROM pg_constraint
        WHERE conrelid = 'market_time_series'::regclass
        AND contype = 'u'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE market_time_series DROP CONSTRAINT %I CASCADE', constraint_record.conname);
            RAISE NOTICE 'Dropped constraint: % (definition: %)', constraint_record.conname, constraint_record.def;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error dropping %: %', constraint_record.conname, SQLERRM;
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
        ALTER TABLE market_time_series
        ADD CONSTRAINT market_time_series_unique 
        UNIQUE (region_id, date, metric_name, data_source, attributes);
        RAISE NOTICE 'Added new unique constraint with JSONB';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;

