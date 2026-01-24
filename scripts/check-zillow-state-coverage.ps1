$env:PGPASSWORD = 'IHatedoingpt12'
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -c @"
-- Check state_code coverage in zillow_zip
SELECT
  COUNT(DISTINCT region_name) as total_zips,
  COUNT(DISTINCT CASE WHEN state_code IS NOT NULL AND state_code != '' THEN region_name END) as has_state,
  COUNT(DISTINCT state_code) as unique_states
FROM zillow_zip
WHERE metric_name = 'zhvi';
"@
