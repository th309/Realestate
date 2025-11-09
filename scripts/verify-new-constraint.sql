SELECT 
    conrelid::regclass::text as table_name,
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'market_time_series'::regclass
AND contype = 'u';

