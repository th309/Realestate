$env:PGPASSWORD = 'IHatedoingpt12'
$env:PAGER = ''

Write-Host "Calculating excess returns (simple version)..." -ForegroundColor Cyan
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -f scripts/calculate-excess-simple.sql

Write-Host "`nDone!" -ForegroundColor Green
