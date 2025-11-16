# Direct Supabase Connection - Using Connection String Format
# This bypasses DNS issues by using the full connection string
# Usage: .\scripts\connect-supabase-direct.ps1 "SELECT version();"

param(
    [string]$Query = "",
    [string]$ProjectRef = "pysflbhpnqwoczyuaaif",
    [string]$Password = "Ihatedoingpt$$12",
    [switch]$Interactive = $false
)

$hostname = "db.${ProjectRef}.supabase.co"
$port = 5432
$database = "postgres"
$username = "postgres"

# URL encode password for connection string
Add-Type -AssemblyName System.Web
$encodedPwd = [System.Web.HttpUtility]::UrlEncode($Password)

# Build connection string
$connectionString = "postgresql://${username}:${encodedPwd}@${hostname}:${port}/${database}?sslmode=require"

Write-Host "🔌 Connecting to Supabase PostgreSQL..." -ForegroundColor Cyan
Write-Host "   Using connection string format (bypasses DNS issues)" -ForegroundColor Gray
Write-Host "   Host: $hostname" -ForegroundColor Gray
Write-Host "   Port: $port" -ForegroundColor Gray
Write-Host "   Database: $database" -ForegroundColor Gray
Write-Host ""

if (-not [string]::IsNullOrEmpty($Query)) {
    Write-Host "Executing query..." -ForegroundColor Yellow
    Write-Host "Query: $Query`n" -ForegroundColor Gray
    
    $result = & psql $connectionString -c $Query 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host $result
        Write-Host "`n✅ Query executed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Query failed" -ForegroundColor Red
        Write-Host $result
        Write-Host "`n💡 If this fails, the hostname may not be accessible from your network." -ForegroundColor Yellow
        Write-Host "   Try: .\scripts\execute-sql.ps1 (uses Supabase API instead)" -ForegroundColor Yellow
        exit $LASTEXITCODE
    }
} else {
    Write-Host "Starting interactive psql session..." -ForegroundColor Yellow
    Write-Host "Type \q to exit`n" -ForegroundColor Gray
    & psql $connectionString
}

