DO $$
DECLARE
    partition_name TEXT;
    constraint_name TEXT;
BEGIN
    FOR partition_name IN
        SELECT relname::text
        FROM pg_class
        WHERE relname LIKE 'market_time_series_%'
        AND relkind = 'r'
        AND relname != 'market_time_series'
        ORDER BY relname
    LOOP
        FOR constraint_name IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = partition_name::regclass
            AND contype = 'u'
            AND conname LIKE '%region_id_date_metric_name%'
        LOOP
            BEGIN
                EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', partition_name, constraint_name);
                RAISE NOTICE 'Dropped constraint % from partition %', constraint_name, partition_name;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Error dropping % from %: %', constraint_name, partition_name, SQLERRM;
            END;
        END LOOP;
    END LOOP;
END $$;

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'market_time_series'::regclass
        AND contype = 'u'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE market_time_series DROP CONSTRAINT %I CASCADE', constraint_name);
            RAISE NOTICE 'Dropped constraint from parent: %', constraint_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error dropping %: %', constraint_name, SQLERRM;
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

