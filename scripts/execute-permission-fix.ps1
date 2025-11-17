# Execute permission fix SQL migration
# Usage: .\scripts\execute-permission-fix.ps1

$ErrorActionPreference = "Stop"

# Load environment variables
$envPath = Join-Path $PSScriptRoot "..\web\.env.local"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$supabaseServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $supabaseUrl -or -not $supabaseServiceKey) {
    Write-Host "❌ Error: Missing Supabase credentials in .env.local" -ForegroundColor Red
    exit 1
}

Write-Host "🔧 Fixing table permissions..." -ForegroundColor Cyan

# Read SQL file
$sqlFile = Join-Path $PSScriptRoot "migrations\004-fix-table-permissions.sql"
$sql = Get-Content $sqlFile -Raw

# Execute using exec_sql RPC
$body = @{
    query = $sql
} | ConvertTo-Json

$headers = @{
    "apikey" = $supabaseServiceKey
    "Authorization" = "Bearer $supabaseServiceKey"
    "Content-Type" = "application/json"
}

$url = "$supabaseUrl/rest/v1/rpc/exec_sql"

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
    Write-Host "✅ Permissions fixed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error executing SQL: $_" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
    exit 1
}

