# Execute Zillow Import Permissions Migration (New)
# Usage: .\scripts\execute-zillow-permissions-new.ps1

$ErrorActionPreference = "Stop"

# Load environment variables
$envPaths = @(
    "packages\frontend\.env.local",
    "packages\backend\.env"
)

foreach ($relativePath in $envPaths) {
    if (Test-Path $relativePath) {
        Write-Host "Loading env from $relativePath" -ForegroundColor Gray
        $fullPath = Resolve-Path $relativePath
        Get-Content $fullPath | ForEach-Object {
            if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                # Remove quotes if present
                $value = $value -replace '^"|"$', '' -replace "^'|'$", ''
                if (-not [string]::IsNullOrEmpty($name)) {
                    [Environment]::SetEnvironmentVariable($name, $value, "Process")
                }
            }
        }
    }
}

$supabaseUrl = if ($env:NEXT_PUBLIC_SUPABASE_URL) { $env:NEXT_PUBLIC_SUPABASE_URL } else { $env:SUPABASE_URL }
$supabaseServiceKey = if ($env:SUPABASE_SERVICE_ROLE_KEY) { $env:SUPABASE_SERVICE_ROLE_KEY } else { $env:SUPABASE_SERVICE_KEY }

if (-not $supabaseUrl -or -not $supabaseServiceKey) {
    Write-Host "❌ Error: Missing Supabase credentials in env files" -ForegroundColor Red
    exit 1
}

Write-Host "🔧 Granting Zillow import permissions... ($supabaseUrl)" -ForegroundColor Cyan

# Read SQL file
$sqlFile = Join-Path $PSScriptRoot "fix-zillow-permissions-new.sql"
$sql = Get-Content $sqlFile -Raw

# Execute using exec_sql RPC
$body = @{
    query = $sql
} | ConvertTo-Json

$headers = @{
    "apikey"        = $supabaseServiceKey
    "Authorization" = "Bearer $supabaseServiceKey"
    "Content-Type"  = "application/json"
}

$url = "$supabaseUrl/rest/v1/rpc/exec_sql"

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
    Write-Host "✅ Permissions granted successfully!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error executing SQL: $_" -ForegroundColor Red
    try {
        $errorDetails = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorDetails)
        $msg = $reader.ReadToEnd()
        Write-Host "Details: $msg" -ForegroundColor Red
    }
    catch {
        Write-Host "No details available." -ForegroundColor Red
    }
    
    # Fallback suggestion if exec_sql is missing
    Write-Host "`nIf the error is related to 'function exec_sql() does not exist', you may need to run the SQL manually via TablePlus or Supabase Dashboard." -ForegroundColor Yellow
    exit 1
}
