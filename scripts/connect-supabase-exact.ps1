# Exact psql connection format as provided
# Usage: .\scripts\connect-supabase-exact.ps1 [query]
# Example: .\scripts\connect-supabase-exact.ps1 "SELECT version();"

param(
    [string]$Query = ""
)

# Use session pooler (works reliably)
$hostname = "aws-1-us-east-1.pooler.supabase.com"
$port = 5432
$database = "postgres"
$username = "postgres.pysflbhpnqwoczyuaaif"
$password = "Ihatedoingpt$$12"

Write-Host "🔌 Connecting to Supabase PostgreSQL via Session Pooler..." -ForegroundColor Cyan
Write-Host "Using: psql -h $hostname -p $port -d $database -U $username" -ForegroundColor Gray
Write-Host ""

# Set password in environment only if not already set
if ([string]::IsNullOrEmpty($env:PGPASSWORD)) {
    $env:PGPASSWORD = $password
}

if (-not [string]::IsNullOrEmpty($Query)) {
    Write-Host "Executing query..." -ForegroundColor Yellow
    Write-Host "Query: $Query`n" -ForegroundColor Gray
    
    # Session pooler format: psql -h aws-1-us-east-1.pooler.supabase.com -p 5432 -d postgres -U postgres.pysflbhpnqwoczyuaaif
    # Use Start-Process or direct execution to avoid auth issues
    $result = & psql -h $hostname -p $port -d $database -U $username -c $Query 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host $result
        Write-Host "`n✅ Query executed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Query failed" -ForegroundColor Red
        Write-Host $result
        Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
        Write-Host "1. Try running directly: `$env:PGPASSWORD='Ihatedoingpt`$`$12'; psql -h $hostname -p $port -d $database -U $username -c `"$Query`"" -ForegroundColor Gray
        Write-Host "2. Check if password needs escaping" -ForegroundColor Gray
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        exit $exitCode
    }
} else {
    Write-Host "Starting interactive psql session..." -ForegroundColor Yellow
    Write-Host "Type \q to exit`n" -ForegroundColor Gray
    
    # Session pooler format: psql -h aws-1-us-east-1.pooler.supabase.com -p 5432 -d postgres -U postgres.pysflbhpnqwoczyuaaif
    & psql -h $hostname -p $port -d $database -U $username
}

# Clean up
Remove-Item Env:\PGPASSWORD

