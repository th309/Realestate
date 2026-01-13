$env:PGPASSWORD = 'Youknowwhy$$12'
$start = Get-Date

Write-Host "Testing connection to aws-1-us-east-1.pooler.supabase.com:6543..." -ForegroundColor Cyan

try {
    # Using specific array argument passing to avoid parsing issues
    $cmdArgs = @(
        '-h', 'aws-1-us-east-1.pooler.supabase.com',
        '-p', '6543',
        '-d', 'postgres',
        '-U', 'postgres.pysflbhpnqwoczyuaaif',
        '-c', 'SELECT version();'
    )
    & psql $cmdArgs 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Success!" -ForegroundColor Green
    }
    else {
        Write-Host "`n❌ Failed with exit code $LASTEXITCODE" -ForegroundColor Red
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

$env:PGPASSWORD = $null
