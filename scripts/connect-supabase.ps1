# Direct Supabase PostgreSQL Connection Script
# Usage: .\scripts\connect-supabase.ps1 [query]
# Example: .\scripts\connect-supabase.ps1 "SELECT COUNT(*) FROM markets;"

param(
    [string]$Query = "",
    [string]$DbHost = "aws-1-us-east-1.pooler.supabase.com",
    [int]$Port = 6543,
    [string]$Database = "postgres",
    [string]$Username = "postgres.pysflbhpnqwoczyuaaif",
    [string]$Password = "",
    [switch]$Interactive = $false
)

# Use exact psql command format: psql -h db.pysflbhpnqwoczyuaaif.supabase.co -p 5432 -d postgres -U postgres

# Connection details
$projectRef = "pysflbhpnqwoczyuaaif"

# Use transaction pooler (port 6543 for transaction mode, 5432 for session mode)
$poolerHost = "aws-1-us-east-1.pooler.supabase.com"
$poolerPort = 6543  # Transaction pooler port
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
            }
            elseif ($envContent -match 'DATABASE_URL=postgresql://[^:]+:([^@]+)@') {
                $Password = $matches[1].Trim()
            }
        }
    }
}

# Set default password if not provided
if ([string]::IsNullOrEmpty($Password)) {
    $Password = "IHatedoingpt12"
}

Write-Host "`nConnecting to Supabase PostgreSQL via Transaction Pooler..." -ForegroundColor Cyan
Write-Host "   Host: $poolerHost" -ForegroundColor Gray
Write-Host "   Port: $poolerPort" -ForegroundColor Gray
Write-Host "   Database: $Database" -ForegroundColor Gray
Write-Host "   Username: $poolerUser" -ForegroundColor Gray
Write-Host ""

# If query provided, execute it
if (-not [string]::IsNullOrEmpty($Query)) {
    Write-Host "Executing query..." -ForegroundColor Yellow
    Write-Host "Query: $Query`n" -ForegroundColor Gray
    
    # Use transaction pooler (port 6543) - set password and disable pager
    $env:PGPASSWORD = $Password
    $env:PAGER = ""
    $result = & psql -h $poolerHost -p $poolerPort -d $Database -U $poolerUser -c $Query 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host $result
        Write-Host "`n[OK] Query executed successfully" -ForegroundColor Green
    }
    else {
        Write-Host "[X] Query failed" -ForegroundColor Red
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
    
    # Use transaction pooler (most reliable)
    Write-Host "Using session pooler connection..." -ForegroundColor Gray
    $env:PGPASSWORD = $Password
    $env:PAGER = ""
    & psql -h $poolerHost -p $poolerPort -d $Database -U $poolerUser
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

# Clean up (final, in case other paths didn't clean)
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\PAGER -ErrorAction SilentlyContinue
