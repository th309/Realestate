$env:PGPASSWORD = 'IHatedoingpt12'
$env:PAGER = ''

Write-Host "Step 1: Calculate national benchmarks..." -ForegroundColor Cyan
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -f scripts/calculate-national-benchmarks.sql

Write-Host "`nStep 2: Calculate excess returns..." -ForegroundColor Cyan
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -f scripts/calculate-excess-returns.sql

Write-Host "`nBenchmark calculations complete!" -ForegroundColor Green
