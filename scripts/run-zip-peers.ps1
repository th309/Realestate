$env:PGPASSWORD = 'IHatedoingpt12'
$env:PAGER = ''

Write-Host "Running ZIP peer group assignment (batched by year)..." -ForegroundColor Cyan

psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -f scripts/assign-zip-peers-batch.sql

Write-Host "`nZIP peer group assignment complete!" -ForegroundColor Green
