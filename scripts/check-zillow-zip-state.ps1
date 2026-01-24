$env:PGPASSWORD = 'IHatedoingpt12'
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -c @"
-- Check state info in zillow_zip
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'zillow_zip'
ORDER BY ordinal_position;
"@
