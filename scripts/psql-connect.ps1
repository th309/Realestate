# Simple psql connection using session pooler
# Usage: .\scripts\psql-connect.ps1 [query]
# Example: .\scripts\psql-connect.ps1 "SELECT COUNT(*) FROM markets;"

param(
    [string]$Query = ""
)

$password = "Ihatedoingpt$$12"

# Session pooler connection (works reliably)
$connString = "postgresql://postgres.pysflbhpnqwoczyuaaif:${password}@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

Write-Host "🔌 Connecting to Supabase via Session Pooler..." -ForegroundColor Cyan
Write-Host ""

if (-not [string]::IsNullOrEmpty($Query)) {
    Write-Host "Executing: $Query`n" -ForegroundColor Yellow
    & psql $connString -c $Query
} else {
    Write-Host "Starting interactive session (type \q to exit)..." -ForegroundColor Yellow
    Write-Host ""
    & psql $connString
}

