# Test Supabase connection parameters for QGIS
$host = "db.pysflbhpnqwoczyuaaif.supabase.co"
$port = "5432"
$database = "postgres"
$username = "postgres"
$password = "Youknowwhy$$12"

Write-Host "Testing Supabase Connection Parameters..." -ForegroundColor Cyan
Write-Host ""

# Check if psql is available
$psql = Get-Command psql -ErrorAction SilentlyContinue
if ($psql) {
    Write-Host "Testing with psql..." -ForegroundColor Yellow
    $env:PGPASSWORD = $password
    $result = & psql -h $host -p $port -U $username -d $database -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connection successful with psql!" -ForegroundColor Green
    } else {
        Write-Host "❌ Connection failed with psql" -ForegroundColor Red
        Write-Host "Error: $result" -ForegroundColor Red
    }
    Remove-Item Env:\PGPASSWORD
} else {
    Write-Host "psql not available. Testing connection string format..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "QGIS Connection Parameters (try these variations):" -ForegroundColor Cyan
Write-Host ""

Write-Host "Option 1 - Standard:" -ForegroundColor Yellow
Write-Host "  Host: $host"
Write-Host "  Port: $port"
Write-Host "  Database: $database"
Write-Host "  Username: $username"
Write-Host "  Password: $password"
Write-Host "  SSL Mode: require"
Write-Host ""

Write-Host "Option 2 - Try 'prefer' SSL:" -ForegroundColor Yellow
Write-Host "  SSL Mode: prefer"
Write-Host ""

Write-Host "Option 3 - Connection String Format:" -ForegroundColor Yellow
Write-Host "  Service: (leave blank)"
Write-Host "  Or use connection string:"
$connString = "host=$host port=$port dbname=$database user=$username password=$password sslmode=require"
Write-Host "  $connString"
Write-Host ""

Write-Host "Common Issues:" -ForegroundColor Cyan
Write-Host "1. Password with $$ might need escaping - try: Youknowwhy`$`$12" -ForegroundColor Yellow
Write-Host "2. SSL mode might need to be 'prefer' instead of 'require'" -ForegroundColor Yellow
Write-Host "3. Try checking 'Save username' and 'Save password' checkboxes" -ForegroundColor Yellow
Write-Host "4. Verify password in Supabase Dashboard → Settings → Database" -ForegroundColor Yellow








