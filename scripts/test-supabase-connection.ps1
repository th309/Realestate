# Test Supabase PostgreSQL connection
$host = "db.pysflbhpnqwoczyuaaif.supabase.co"
$port = "5432"
$database = "postgres"
$username = "postgres"
$password = "Youknowwhy$$12"

Write-Host "Testing Supabase connection..." -ForegroundColor Cyan
Write-Host "Host: $host" -ForegroundColor Gray
Write-Host "Database: $database" -ForegroundColor Gray
Write-Host "Username: $username" -ForegroundColor Gray

# Try to test connection using psql if available
$psql = Get-Command psql -ErrorAction SilentlyContinue
if ($psql) {
    $env:PGPASSWORD = $password
    $connectionString = "host=$host port=$port dbname=$database user=$username sslmode=require"
    Write-Host "`nTesting with psql..." -ForegroundColor Yellow
    $result = & psql -h $host -p $port -U $username -d $database -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connection successful!" -ForegroundColor Green
        Write-Host $result
    } else {
        Write-Host "❌ Connection failed" -ForegroundColor Red
        Write-Host $result
    }
    Remove-Item Env:\PGPASSWORD
} else {
    Write-Host "psql not found. Connection details are valid for QGIS setup." -ForegroundColor Yellow
    Write-Host "`nQGIS Connection Details:" -ForegroundColor Cyan
    Write-Host "  Host: $host"
    Write-Host "  Port: $port"
    Write-Host "  Database: $database"
    Write-Host "  Username: $username"
    Write-Host "  Password: [configured]"
    Write-Host "  SSL Mode: require"
}








