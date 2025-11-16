# Direct Supabase PostgreSQL Connection Script
# Usage: .\scripts\connect-supabase.ps1 [query]
# Example: .\scripts\connect-supabase.ps1 "SELECT COUNT(*) FROM markets;"

param(
    [string]$Query = "",
    [string]$DbHost = "db.pysflbhpnqwoczyuaaif.supabase.co",
    [int]$Port = 5432,
    [string]$Database = "postgres",
    [string]$Username = "postgres",
    [string]$Password = "",
    [switch]$Interactive = $false
)

# Use exact psql command format: psql -h db.pysflbhpnqwoczyuaaif.supabase.co -p 5432 -d postgres -U postgres

# Connection details
$projectRef = "pysflbhpnqwoczyuaaif"

# Use session pooler (works reliably)
$poolerHost = "aws-1-us-east-1.pooler.supabase.com"
$poolerPort = 5432
$poolerUser = "postgres.${projectRef}"

# Try to get password from environment or use default
if ([string]::IsNullOrEmpty($Password)) {
    $Password = $env:SUPABASE_DB_PASSWORD
    if ([string]::IsNullOrEmpty($Password)) {
        # Try reading from .env.local if it exists
        $envPath = Join-Path $PSScriptRoot "..\web\.env.local"
        if (Test-Path $envPath) {
            $envContent = Get-Content $envPath -Raw
            if ($envContent -match 'SUPABASE_DB_PASSWORD=(.+)') {
                $Password = $matches[1].Trim()
            } elseif ($envContent -match 'DATABASE_URL=postgresql://[^:]+:([^@]+)@') {
                $Password = $matches[1].Trim()
            }
        }
    }
}

# Set default password if not provided
if ([string]::IsNullOrEmpty($Password)) {
    $Password = "Ihatedoingpt$$12"
}

Write-Host "`n🔌 Connecting to Supabase PostgreSQL via Session Pooler..." -ForegroundColor Cyan
Write-Host "   Host: $poolerHost" -ForegroundColor Gray
Write-Host "   Port: $poolerPort" -ForegroundColor Gray
Write-Host "   Database: $Database" -ForegroundColor Gray
Write-Host "   Username: $poolerUser" -ForegroundColor Gray
Write-Host ""

# If query provided, execute it
if (-not [string]::IsNullOrEmpty($Query)) {
    Write-Host "Executing query..." -ForegroundColor Yellow
    Write-Host "Query: $Query`n" -ForegroundColor Gray
    
    # Use session pooler (works reliably) - set password right before command
    $env:PGPASSWORD = $Password
    $result = & psql -h $poolerHost -p $poolerPort -d $Database -U $poolerUser -c $Query 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host $result
        Write-Host "`n✅ Query executed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Query failed" -ForegroundColor Red
        Write-Host $result
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        exit $exitCode
    }
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
# If interactive mode or no query, start interactive session
elseif ($Interactive -or [string]::IsNullOrEmpty($Query)) {
    Write-Host "Starting interactive psql session..." -ForegroundColor Yellow
    Write-Host "Type \q to exit`n" -ForegroundColor Gray
    
    # Use session pooler (most reliable)
    Write-Host "Using session pooler connection..." -ForegroundColor Gray
    $env:PGPASSWORD = $Password
    & psql -h $poolerHost -p $poolerPort -d $Database -U $poolerUser
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

# Clean up
Remove-Item Env:\PGPASSWORD

