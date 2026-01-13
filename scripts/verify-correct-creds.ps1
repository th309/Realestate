$uri = "postgresql://postgres.pysflbhpnqwoczyuaaif:IHatedoingpt12@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

Write-Host "Testing URI connection with corrected credentials..." -ForegroundColor Cyan
& psql $uri -c "SELECT version();" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Success!" -ForegroundColor Green
}
else {
    Write-Host "`n❌ Failed." -ForegroundColor Red
}
