$env:PGPASSWORD = 'IHatedoingpt12'
$env:PAGER = ''

Write-Host "Step 1: Creating ZIP peer lookup table..." -ForegroundColor Cyan
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -f scripts/create-zip-peers-lookup.sql

Write-Host "`nStep 2: Updating ZIP peer groups (batched by year)..." -ForegroundColor Cyan
psql -h aws-1-us-east-1.pooler.supabase.com -p 6543 -U postgres.pysflbhpnqwoczyuaaif -d postgres -f scripts/update-zip-peers-batch.sql

Write-Host "`nZIP peer group assignment complete!" -ForegroundColor Green
