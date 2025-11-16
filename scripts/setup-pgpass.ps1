# Setup .pgpass file for psql authentication
# This avoids password authentication issues

$pgpassPath = "$env:USERPROFILE\.pgpass"
$password = "Ihatedoingpt$$12"

# Session pooler entry
$pgpassEntry = "aws-1-us-east-1.pooler.supabase.com:5432:postgres:postgres.pysflbhpnqwoczyuaaif:${password}"

Write-Host "Setting up .pgpass file..." -ForegroundColor Cyan

# Read existing .pgpass if it exists
$existingEntries = @()
if (Test-Path $pgpassPath) {
    $existingEntries = Get-Content $pgpassPath
    Write-Host "Found existing .pgpass file" -ForegroundColor Gray
}

# Check if entry already exists
$entryExists = $existingEntries | Where-Object { $_ -match "aws-1-us-east-1.pooler.supabase.com" }

if (-not $entryExists) {
    # Add new entry
    $allEntries = $existingEntries + $pgpassEntry
    $allEntries | Set-Content $pgpassPath -Encoding ASCII
    Write-Host "✅ Added Supabase session pooler entry to .pgpass" -ForegroundColor Green
} else {
    Write-Host "✅ Supabase entry already exists in .pgpass" -ForegroundColor Green
}

# Set correct permissions (Windows: file permissions, Unix: chmod 600)
if ($IsWindows -or $env:OS -match "Windows") {
    # On Windows, .pgpass should be readable only by the user
    $acl = Get-Acl $pgpassPath
    $acl.SetAccessRuleProtection($true, $false)
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($env:USERNAME, "Read", "Allow")
    $acl.SetAccessRule($accessRule)
    Set-Acl $pgpassPath $acl
    Write-Host "✅ Set file permissions" -ForegroundColor Green
}

Write-Host ""
Write-Host "Now you can connect without password:" -ForegroundColor Cyan
Write-Host "  psql -h aws-1-us-east-1.pooler.supabase.com -p 5432 -d postgres -U postgres.pysflbhpnqwoczyuaaif" -ForegroundColor White

