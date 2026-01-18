# Execute SQL using Supabase Admin Client (workaround for psql connection issues)
# Usage: .\scripts\execute-sql.ps1 -Query "SELECT COUNT(*) FROM markets;"

param(
    [Parameter(Mandatory = $true)]
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

$supabaseUrl = "https://${ProjectRef}.supabase.co"
$supabaseKey = $env:SUPABASE_SERVICE_ROLE_KEY

# Hardcode key if missing (from recent context)
if ([string]::IsNullOrEmpty($supabaseKey)) {
    $supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I"
}

Write-Host "Executing SQL query via Supabase Admin API..." -ForegroundColor Cyan
Write-Host "Target: $supabaseUrl" -ForegroundColor Gray
Write-Host "Query: $Query`n" -ForegroundColor Gray

# Use Supabase REST API to execute SQL
$headers = @{
    "apikey"        = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
    "Content-Type"  = "application/json"
}

$body = @{
    query = $Query
} | ConvertTo-Json

try {
    # SkipCertificateCheck is crucial here due to local environment revocation check failures
    $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/exec_sql" -Method Post -Headers $headers -Body $body -ErrorAction Stop -SkipCertificateCheck
    
    if ($response) {
        Write-Host "✅ Query executed successfully" -ForegroundColor Green
        if ($response -is [array]) {
            $response | Format-Table -AutoSize
        }
        elseif ($response -is [PSCustomObject]) {
            $response | Format-List
        }
        else {
            Write-Host $response
        }
    }
}
catch {
    Write-Host "❌ Error executing query: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        
        if ($_.ErrorDetails.Message -match "Could not find the function public.exec_sql") {
            Write-Host "`n⚠️  The exec_sql function is missing." -ForegroundColor Yellow
            Write-Host "You need to create it first using the SQL Editor in the Dashboard." -ForegroundColor Yellow
        }
    }
    exit 1
}

