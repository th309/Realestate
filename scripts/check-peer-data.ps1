$env:PGPASSWORD = 'IHatedoingpt12'
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -c @"
SELECT
  'census_acs_zip' as table_name,
  COUNT(*) as row_count,
  COUNT(total_population) as has_pop,
  COUNT(median_household_income) as has_income
FROM census_acs_zip
UNION ALL
SELECT
  'zillow_zip_zhvi_latest' as table_name,
  COUNT(DISTINCT region_name) as row_count,
  0 as has_pop,
  0 as has_income
FROM zillow_zip
WHERE metric_name = 'zhvi' AND period_date = '2024-11-01';
"@
