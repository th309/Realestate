$env:PGPASSWORD = 'IHatedoingpt12'
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -c @"
-- Check state info in census_zip
SELECT
  year,
  COUNT(*) as total,
  COUNT(NULLIF(state_fips, '')) as has_state_fips,
  COUNT(NULLIF(state_name, '')) as has_state_name,
  MIN(median_home_value) as min_value,
  MAX(median_home_value) as max_value
FROM census_zip
WHERE year = 2023
GROUP BY year;
"@
