SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'market_time_series'::regclass
AND contype = 'u';

SELECT 
    conrelid::regclass::text as table_name,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'market_time_series_2000'::regclass
AND contype = 'u'
LIMIT 1;

