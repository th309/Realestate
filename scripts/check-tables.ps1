$env:PGPASSWORD = 'IHatedoingpt12'
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -c @"
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE '%census%' OR table_name LIKE '%acs%' OR table_name LIKE '%peer%' OR table_name LIKE '%benchmark%')
ORDER BY table_name;
"@
