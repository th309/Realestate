$env:PGPASSWORD = 'IHatedoingpt12'
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -c @"
-- Check latest census data coverage
SELECT
  year,
  COUNT(*) as total_zips,
  COUNT(total_population) as has_pop,
  COUNT(median_home_value) as has_home_value,
  COUNT(state_fips) as has_state
FROM census_zip
GROUP BY year
ORDER BY year DESC
LIMIT 5;
"@
