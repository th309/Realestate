#!/usr/bin/env pwsh
# Quick start script for hybrid optimization workflow

Write-Host "🚀 Starting Quinn Optimization - Hybrid Mode" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
$backendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $backendRunning = $true
    }
} catch {
    $backendRunning = $false
}

if (-not $backendRunning) {
    Write-Host "❌ Local backend is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start it in another terminal:" -ForegroundColor Yellow
    Write-Host "  cd packages/backend" -ForegroundColor Gray
    Write-Host "  npm run start:dev" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "✅ Local backend is running at http://localhost:3001" -ForegroundColor Green
Write-Host ""

# Check analytics service connection
Write-Host "🔍 Checking analytics service connection..." -ForegroundColor Cyan
try {
    $analyticsResponse = Invoke-WebRequest -Uri "https://realestate-production.up.railway.app/health" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($analyticsResponse.StatusCode -eq 200) {
        Write-Host "✅ Production analytics service is reachable" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not reach production analytics service" -ForegroundColor Yellow
    Write-Host "   Tests may fail if analytics service is down" -ForegroundColor Gray
}

Write-Host ""
Write-Host "📋 Running comprehensive test suite..." -ForegroundColor Cyan
Write-Host ""

# Run the optimizer
npx tsx scripts/quinn-test/optimize-prompts.ts scripts/quinn-test/comprehensive-prompts.txt --url http://localhost:3001

Write-Host ""
Write-Host "✨ Optimization complete!" -ForegroundColor Green
