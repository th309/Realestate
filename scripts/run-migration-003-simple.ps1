# Run Migration 003: Add Geographic Normalization Columns
# This script executes the SQL migration using the Supabase REST API

param(
    [string]$SupabaseUrl = "https://pysflbhpnqwoczyuaaif.supabase.co",
    [string]$ServiceRoleKey = ""
)

# Try to load from web/.env.local
$envPath = Join-Path $PSScriptRoot "..\web\.env.local"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            if (-not [string]::IsNullOrEmpty($key) -and -not [string]::IsNullOrEmpty($value)) {
                if ($key -eq "NEXT_PUBLIC_SUPABASE_URL" -and [string]::IsNullOrEmpty($SupabaseUrl)) {
                    $SupabaseUrl = $value
                }
                if ($key -eq "SUPABASE_SERVICE_ROLE_KEY" -and [string]::IsNullOrEmpty($ServiceRoleKey)) {
                    $ServiceRoleKey = $value
                }
            }
        }
    }
}

if ([string]::IsNullOrEmpty($ServiceRoleKey)) {
    Write-Host "❌ Error: SUPABASE_SERVICE_ROLE_KEY not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please provide the service role key:" -ForegroundColor Yellow
    Write-Host "  .\scripts\run-migration-003-simple.ps1 -ServiceRoleKey 'your-key-here'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or set it in web/.env.local as SUPABASE_SERVICE_ROLE_KEY=..." -ForegroundColor Yellow
    exit 1
}

Write-Host "📄 Reading migration file..." -ForegroundColor Cyan
$migrationFile = Join-Path $PSScriptRoot "migrations\003-add-geographic-normalization-columns.sql"
$sql = Get-Content $migrationFile -Raw

Write-Host "🔌 Connecting to Supabase..." -ForegroundColor Cyan
Write-Host "   URL: $SupabaseUrl" -ForegroundColor Gray
Write-Host ""

# Split SQL into statements
$statements = $sql -split ';' | Where-Object { 
    $_.Trim() -ne '' -and 
    -not ($_.Trim() -match '^--') -and
    -not ($_.Trim() -match '^/\*')
}

Write-Host "📝 Found $($statements.Count) SQL statements to execute" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "apikey" = $ServiceRoleKey
    "Authorization" = "Bearer $ServiceRoleKey"
    "Content-Type" = "application/json"
}

$successCount = 0
$failCount = 0

foreach ($statement in $statements) {
    $statement = $statement.Trim()
    if ([string]::IsNullOrEmpty($statement)) { continue }
    
    # Skip verification queries
    if ($statement -match 'SELECT column_name|SELECT indexname') { continue }
    
    $statementNum = $successCount + $failCount + 1
    Write-Host "📝 Executing statement $statementNum/$($statements.Count)..." -ForegroundColor Yellow
    
    $body = @{
        query = $statement
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/rpc/exec_sql" -Method Post -Headers $headers -Body $body -ErrorAction Stop
        Write-Host "   ✅ Statement $statementNum executed successfully" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "   ❌ Error executing statement $statementNum" -ForegroundColor Red
        Write-Host "      $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "      $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "   Statement:" -ForegroundColor Yellow
        Write-Host "      $($statement.Substring(0, [Math]::Min(200, $statement.Length)))..." -ForegroundColor Gray
        Write-Host ""
        $failCount++
    }
}

Write-Host ""
if ($failCount -eq 0) {
    Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
    Write-Host "   Executed: $successCount statements" -ForegroundColor Green
} else {
    Write-Host "⚠️  Migration completed with errors" -ForegroundColor Yellow
    Write-Host "   Successful: $successCount" -ForegroundColor Green
    Write-Host "   Failed: $failCount" -ForegroundColor Red
    exit 1
}

