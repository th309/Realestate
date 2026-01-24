# Run Supabase Migration Script
# Usage: .\scripts\run-migration.ps1 -MigrationFile "057-create-building-permits-tables.sql"
# Usage: .\scripts\run-migration.ps1 -MigrationNumber 57
# Usage: .\scripts\run-migration.ps1 -All  (runs all pending migrations)

param(
    [string]$MigrationFile = "",
    [int]$MigrationNumber = 0,
    [switch]$All = $false,
    [switch]$DryRun = $false,
    [string]$DbHost = "aws-1-us-east-1.pooler.supabase.com",
    [int]$Port = 6543,
    [string]$Database = "postgres",
    [string]$ProjectRef = "pysflbhpnqwoczyuaaif"
)

# Connection details
$poolerHost = $DbHost
$poolerPort = $Port
$poolerUser = "postgres.${ProjectRef}"
$Password = $env:SUPABASE_DB_PASSWORD
if ([string]::IsNullOrEmpty($Password)) {
    $Password = "IHatedoingpt12"
}

# Set environment for psql
$env:PGPASSWORD = $Password
$env:PAGER = ""

$migrationsDir = Join-Path $PSScriptRoot "migrations"

function Invoke-SQL {
    param([string]$Query)
    $result = & psql -h $poolerHost -p $poolerPort -d $Database -U $poolerUser -c $Query 2>&1
    return @{
        Output   = $result
        ExitCode = $LASTEXITCODE
    }
}

function Invoke-SQLFile {
    param([string]$FilePath)
    $result = & psql -h $poolerHost -p $poolerPort -d $Database -U $poolerUser -f $FilePath 2>&1
    return @{
        Output   = $result
        ExitCode = $LASTEXITCODE
    }
}

Write-Host "`nSupabase Migration Runner" -ForegroundColor Cyan
Write-Host "   Host: ${poolerHost}:${poolerPort}" -ForegroundColor Gray
Write-Host "   Database: $Database" -ForegroundColor Gray
Write-Host ""

# Test connection first
Write-Host "Testing connection..." -ForegroundColor Yellow
$testResult = Invoke-SQL "SELECT 1 as connection_test;"
if ($testResult.ExitCode -ne 0) {
    Write-Host "[X] Connection failed!" -ForegroundColor Red
    Write-Host $testResult.Output
    exit 1
}
Write-Host "[OK] Connection successful" -ForegroundColor Green
Write-Host ""

# Determine which migration(s) to run
$migrations = @()

if (-not [string]::IsNullOrEmpty($MigrationFile)) {
    # Specific file provided
    $fullPath = Join-Path $migrationsDir $MigrationFile
    if (-not (Test-Path $fullPath)) {
        Write-Host "[X] Migration file not found: $MigrationFile" -ForegroundColor Red
        exit 1
    }
    $migrations += $fullPath
}
elseif ($MigrationNumber -gt 0) {
    # Find migration by number
    $pattern = "{0:D3}-*.sql" -f $MigrationNumber
    $found = Get-ChildItem -Path $migrationsDir -Filter $pattern | Select-Object -First 1
    if (-not $found) {
        Write-Host "[X] No migration found with number: $MigrationNumber" -ForegroundColor Red
        exit 1
    }
    $migrations += $found.FullName
}
elseif ($All) {
    # Get all SQL migrations in order
    $migrations = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name | Select-Object -ExpandProperty FullName
}
else {
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\scripts\run-migration.ps1 -MigrationFile '057-create-building-permits-tables.sql'" -ForegroundColor Gray
    Write-Host "  .\scripts\run-migration.ps1 -MigrationNumber 57" -ForegroundColor Gray
    Write-Host "  .\scripts\run-migration.ps1 -All" -ForegroundColor Gray
    Write-Host "  .\scripts\run-migration.ps1 -All -DryRun  # Preview only" -ForegroundColor Gray
    exit 0
}

if ($migrations.Count -eq 0) {
    Write-Host "No migrations to run." -ForegroundColor Yellow
    exit 0
}

Write-Host "Migrations to run: $($migrations.Count)" -ForegroundColor Cyan
foreach ($m in $migrations) {
    $name = Split-Path -Leaf $m
    Write-Host "  - $name" -ForegroundColor Gray
}
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN] No changes will be made" -ForegroundColor Yellow
    exit 0
}

# Run migrations
$successCount = 0
$failCount = 0

foreach ($migrationPath in $migrations) {
    $migrationName = Split-Path -Leaf $migrationPath
    Write-Host "> Running: $migrationName" -ForegroundColor Yellow
    
    $result = Invoke-SQLFile $migrationPath
    
    if ($result.ExitCode -eq 0) {
        Write-Host "  [OK] Success" -ForegroundColor Green
        $successCount++
    }
    else {
        Write-Host "  [X] Failed" -ForegroundColor Red
        Write-Host $result.Output -ForegroundColor Gray
        $failCount++
        
        # Stop on first failure
        Write-Host "`nStopping due to migration failure." -ForegroundColor Red
        break
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Migration Summary:" -ForegroundColor Cyan
Write-Host "  [OK] Successful: $successCount" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "  [X] Failed: $failCount" -ForegroundColor Red
}
Write-Host "========================================`n" -ForegroundColor Cyan

# Cleanup
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\PAGER -ErrorAction SilentlyContinue

exit $failCount
