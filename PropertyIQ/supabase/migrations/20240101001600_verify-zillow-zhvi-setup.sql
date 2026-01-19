-- Diagnostic: Verify Zillow ZHVI Setup
-- Run this in Supabase SQL Editor to diagnose the 500 error

-- 1. Check if zillow_zhvi table exists and has data
SELECT 'zillow_zhvi table count' as check_name, COUNT(*) as result FROM zillow_zhvi;

-- 2. Check for state-level ZHVI data specifically
SELECT 'state ZHVI records' as check_name, COUNT(*) as result
FROM zillow_zhvi
WHERE geography = 'state' AND property_type = 'all_homes';

-- 3. Check if markets table has state records
SELECT 'state market records' as check_name, COUNT(*) as result
FROM markets
WHERE region_type = 'state';

-- 4. Sample of state markets
SELECT region_id, region_name, region_type
FROM markets
WHERE region_type = 'state'
LIMIT 5;

-- 5. Sample of recent ZHVI data
SELECT region_id, date, value, geography, property_type
FROM zillow_zhvi
WHERE geography = 'state'
ORDER BY date DESC
LIMIT 5;

-- 6. Test the actual join query used by the API
SELECT m.region_name, z.value, z.date
FROM markets m
JOIN zillow_zhvi z ON m.region_id = z.region_id
WHERE m.region_type = 'state'
  AND z.geography = 'state'
  AND z.property_type = 'all_homes'
ORDER BY z.date DESC
LIMIT 10;
