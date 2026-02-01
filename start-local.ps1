# Start Local Development - Analytics + Backend + Frontend
# Usage: .\start-local.ps1

Write-Host "Starting REI Platform locally..." -ForegroundColor Cyan
Write-Host ""

# Start analytics service in new window
Write-Host "Starting Analytics Service on http://localhost:8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\start-analytics.ps1"

# Wait for analytics to start
Start-Sleep -Seconds 5

# Start backend in new window
Write-Host "Starting Backend on http://localhost:3001..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd packages\backend; npm run start:dev"

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend in new window
Write-Host "Starting Frontend on http://localhost:3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd packages\frontend; npm run dev"

Write-Host ""
Write-Host "✓ Analytics Service starting on http://localhost:8000" -ForegroundColor Green
Write-Host "✓ Backend starting on http://localhost:3001" -ForegroundColor Green
Write-Host "✓ Frontend starting on http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Once all services are ready, open http://localhost:3000 in your browser!" -ForegroundColor Cyan
