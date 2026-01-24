$env:PGPASSWORD = 'IHatedoingpt12'
$env:PAGER = ''

Write-Host "Calculating excess returns vs national benchmark..." -ForegroundColor Cyan
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -f scripts/calculate-excess-returns.sql

Write-Host "`nExcess returns calculation complete!" -ForegroundColor Green
