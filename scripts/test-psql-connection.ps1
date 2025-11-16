# Quick test script for Supabase psql connection
# Usage: .\scripts\test-psql-connection.ps1

$dbHost = "db.pysflbhpnqwoczyuaaif.supabase.co"
$port = 5432
$database = "postgres"
$username = "postgres"
$password = "Ihatedoingpt$$12"

Write-Host "Testing Supabase PostgreSQL connection..." -ForegroundColor Cyan
Write-Host "Host: $dbHost" -ForegroundColor Gray
Write-Host "Port: $port" -ForegroundColor Gray
Write-Host "Database: $database" -ForegroundColor Gray
Write-Host "Username: $username" -ForegroundColor Gray
Write-Host ""

# Set password in environment
$env:PGPASSWORD = $password

# Try connection with connection string format (sometimes works better)
Write-Host "Attempting connection..." -ForegroundColor Yellow

# Method 1: Direct psql command
$connectionString = "postgresql://${username}:${password}@${dbHost}:${port}/${database}?sslmode=require"
Write-Host "Trying connection string format..." -ForegroundColor Gray
$result = & psql $connectionString -c "SELECT version();" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Connection successful!" -ForegroundColor Green
    Write-Host $result
} else {
    Write-Host "`n❌ Connection failed with connection string format" -ForegroundColor Red
    Write-Host $result
    
    # Method 2: Try with -h flag
    Write-Host "`nTrying with -h flag..." -ForegroundColor Gray
    $result2 = & psql -h $dbHost -p $port -U $username -d $database -c "SELECT version();" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Connection successful with -h flag!" -ForegroundColor Green
        Write-Host $result2
    } else {
        Write-Host "`n❌ Connection failed" -ForegroundColor Red
        Write-Host $result2
        Write-Host "`nTroubleshooting tips:" -ForegroundColor Yellow
        Write-Host "1. Check if the hostname resolves: nslookup $dbHost" -ForegroundColor Gray
        Write-Host "2. Try port 6543 (connection pooling): -p 6543" -ForegroundColor Gray
        Write-Host "3. Verify password is correct" -ForegroundColor Gray
        Write-Host "4. Check firewall/network settings" -ForegroundColor Gray
    }
}

# Clean up
Remove-Item Env:\PGPASSWORD

Write-Host "`nTo connect interactively, use:" -ForegroundColor Cyan
Write-Host "  .\scripts\connect-supabase.ps1 -Interactive" -ForegroundColor White

