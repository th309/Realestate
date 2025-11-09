DO $$
DECLARE
    constraint_record RECORD;
    table_record RECORD;
BEGIN
    RAISE NOTICE 'Step 1: Dropping constraints from parent table...';
    
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'market_time_series'::regclass
        AND contype = 'u'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE market_time_series DROP CONSTRAINT %I CASCADE', constraint_record.conname);
            RAISE NOTICE 'Dropped constraint from parent: %', constraint_record.conname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error dropping %: %', constraint_record.conname, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Step 2: Dropping constraints from individual partitions...';
    
    FOR table_record IN
        SELECT relname::text as table_name
        FROM pg_class
        WHERE relname LIKE 'market_time_series_%'
        AND relkind = 'r'
        AND relname != 'market_time_series'
    LOOP
        FOR constraint_record IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = table_record.table_name::regclass
            AND contype = 'u'
            AND (conname LIKE '%region_id_date_metric_name%' OR conname LIKE '%property_type%' OR conname LIKE '%tier%')
        LOOP
            BEGIN
                EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', table_record.table_name, constraint_record.conname);
                RAISE NOTICE 'Dropped constraint % from partition %', constraint_record.conname, table_record.table_name;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not drop % from %: %', constraint_record.conname, table_record.table_name, SQLERRM;
            END;
        END LOOP;
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
