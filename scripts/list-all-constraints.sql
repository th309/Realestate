SELECT 
    conrelid::regclass::text as table_name,
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid IN (
    SELECT oid FROM pg_class 
    WHERE relname LIKE 'market_time_series%'
    AND relkind = 'r'
)
AND contype = 'u'
ORDER BY table_name, constraint_name;

