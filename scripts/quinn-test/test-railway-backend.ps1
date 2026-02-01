#!/usr/bin/env pwsh
# Simple test to verify Railway backend is responding

Write-Host "Testing Railway backend..." -ForegroundColor Cyan

$body = @{
    message = "What are the top 5 metros for investors?"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest `
        -Uri "https://backend-production-ee4d.up.railway.app/analytics/chat/test-$(Get-Date -Format 'yyyyMMddHHmmss')" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 30
    
    Write-Host "✅ Backend responded!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "Response:" -ForegroundColor Gray
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
    exit 0
}
catch {
    Write-Host "❌ Backend not responding" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Gray
    exit 1
}
