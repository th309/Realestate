# Get working Supabase connection details
# This script helps you get the correct connection string from Supabase

Write-Host "🔍 Getting Supabase Connection Details" -ForegroundColor Cyan
Write-Host ""

$projectRef = "pysflbhpnqwoczyuaaif"
$dashboardUrl = "https://supabase.com/dashboard/project/${projectRef}/settings/database"

Write-Host "Please follow these steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Open your browser and go to:" -ForegroundColor White
Write-Host "   $dashboardUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Look for 'Connection string' or 'Connection parameters'" -ForegroundColor White
Write-Host ""
Write-Host "3. Copy the connection string (it will look like):" -ForegroundColor White
Write-Host "   postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres" -ForegroundColor Gray
Write-Host ""
Write-Host "4. The connection string might use:" -ForegroundColor White
Write-Host "   - A different hostname (not db.pysflbhpnqwoczyuaaif.supabase.co)" -ForegroundColor Gray
Write-Host "   - An IP address" -ForegroundColor Gray
Write-Host "   - A pooler hostname" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Once you have it, update scripts/connect-supabase.ps1 with the correct hostname" -ForegroundColor White
Write-Host ""
Write-Host "Alternative: Use the API-based solution (works now):" -ForegroundColor Yellow
Write-Host "   .\scripts\execute-sql.ps1 'SELECT version();'" -ForegroundColor Cyan
Write-Host ""

# Try to open the dashboard
$open = Read-Host "Open dashboard in browser? (Y/N)"
if ($open -eq 'Y' -or $open -eq 'y') {
    Start-Process $dashboardUrl
}

