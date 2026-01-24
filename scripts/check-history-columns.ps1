$env:PGPASSWORD = 'IHatedoingpt12'
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -c @"
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'propertyiq_scores_history'
AND (column_name LIKE '%peer%' OR column_name LIKE '%excess%' OR column_name LIKE '%parent%')
ORDER BY ordinal_position;
"@
