# Execute SQL using Supabase Admin Client (workaround for psql connection issues)
# Usage: .\scripts\execute-sql.ps1 "SELECT COUNT(*) FROM markets;"

param(
    [Parameter(Mandatory=$true)]
    [string]$Query,
    
    [string]$ProjectRef = "pysflbhpnqwoczyuaaif"
)

# Load environment variables
$envPath = Join-Path $PSScriptRoot "..\web\.env.local"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            if (-not [string]::IsNullOrEmpty($key) -and -not [string]::IsNullOrEmpty($value)) {
                [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
            }
        }
    }
}

$supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$supabaseKey = $env:SUPABASE_SERVICE_ROLE_KEY

if ([string]::IsNullOrEmpty($supabaseUrl)) {
    $supabaseUrl = "https://${ProjectRef}.supabase.co"
}

if ([string]::IsNullOrEmpty($supabaseKey)) {
    Write-Host "❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment" -ForegroundColor Red
    Write-Host "Please set it in web/.env.local or as environment variable" -ForegroundColor Yellow
    exit 1
}

Write-Host "Executing SQL query via Supabase Admin API..." -ForegroundColor Cyan
Write-Host "Query: $Query`n" -ForegroundColor Gray

# Use Supabase REST API to execute SQL
$headers = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
    "Content-Type" = "application/json"
}

$body = @{
    query = $Query
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/exec_sql" -Method Post -Headers $headers -Body $body -ErrorAction Stop
    
    if ($response) {
        Write-Host "✅ Query executed successfully" -ForegroundColor Green
        if ($response -is [array]) {
            $response | Format-Table -AutoSize
        } elseif ($response -is [PSCustomObject]) {
            $response | Format-List
        } else {
            Write-Host $response
        }
    }
} catch {
    Write-Host "❌ Error executing query: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    exit 1
}

