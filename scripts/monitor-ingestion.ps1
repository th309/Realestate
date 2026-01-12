
while ($true) {
    Clear-Host
    Write-Host "📊 Zillow Ingestion Monitor - Refreshing every 60s" -ForegroundColor Cyan
    Write-Host "=================================================="
    Write-Host "Time: $(Get-Date)" -ForegroundColor Gray
    Write-Host ""
    
    npx tsx scripts/verify-zillow-new-tables.ts
    
    Write-Host ""
    Write-Host "Next update in 60 seconds..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 60
}
