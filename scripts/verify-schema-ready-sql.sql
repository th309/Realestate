-- Verification queries for schema readiness
-- Run these queries to check if all required columns and indexes exist

-- Check columns in tiger_states
SELECT 
    'tiger_states' as table_name,
    column_name,
    data_type,
    character_maximum_length,
    CASE WHEN column_name IN ('state_abbreviation', 'population', 'name_fragment') THEN 'REQUIRED' ELSE 'OTHER' END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tiger_states'
  AND column_name IN ('state_abbreviation', 'population', 'name_fragment')
ORDER BY column_name;

-- Check columns in tiger_counties
SELECT 
    'tiger_counties' as table_name,
    column_name,
    data_type,
    character_maximum_length,
    CASE WHEN column_name IN ('population', 'county_name_fragment', 'pct_of_state_population') THEN 'REQUIRED' ELSE 'OTHER' END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tiger_counties'
  AND column_name IN ('population', 'county_name_fragment', 'pct_of_state_population')
ORDER BY column_name;

-- Check columns in tiger_cbsa
SELECT 
    'tiger_cbsa' as table_name,
    column_name,
    data_type,
    character_maximum_length,
    CASE WHEN column_name = 'population' THEN 'REQUIRED' ELSE 'OTHER' END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tiger_cbsa'
  AND column_name = 'population'
ORDER BY column_name;

-- Check columns in tiger_zcta
SELECT 
    'tiger_zcta' as table_name,
    column_name,
    data_type,
    character_maximum_length,
    CASE WHEN column_name IN ('population', 'default_city', 'default_state', 'cbsa_code') THEN 'REQUIRED' ELSE 'OTHER' END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tiger_zcta'
  AND column_name IN ('population', 'default_city', 'default_state', 'cbsa_code')
ORDER BY column_name;

-- Check indexes
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('tiger_states', 'tiger_counties', 'tiger_cbsa', 'tiger_zcta')
  AND indexname LIKE 'idx_tiger_%'
ORDER BY tablename, indexname;

-- Summary: Count missing columns
SELECT 
    'SUMMARY' as check_type,
    'tiger_states' as table_name,
    COUNT(*) FILTER (WHERE column_name = 'state_abbreviation') as has_state_abbreviation,
    COUNT(*) FILTER (WHERE column_name = 'population') as has_population,
    COUNT(*) FILTER (WHERE column_name = 'name_fragment') as has_name_fragment
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tiger_states'
UNION ALL
SELECT 
    'SUMMARY',
    'tiger_counties',
    COUNT(*) FILTER (WHERE column_name = 'population'),
    COUNT(*) FILTER (WHERE column_name = 'county_name_fragment'),
    COUNT(*) FILTER (WHERE column_name = 'pct_of_state_population')
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tiger_counties'
UNION ALL
SELECT 
    'SUMMARY',
    'tiger_cbsa',
    COUNT(*) FILTER (WHERE column_name = 'population'),
    0,
    0
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tiger_cbsa'
UNION ALL
SELECT 
    'SUMMARY',
    'tiger_zcta',
    COUNT(*) FILTER (WHERE column_name = 'population'),
    COUNT(*) FILTER (WHERE column_name = 'default_city'),
    COUNT(*) FILTER (WHERE column_name = 'default_state') + COUNT(*) FILTER (WHERE column_name = 'cbsa_code')
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tiger_zcta';

