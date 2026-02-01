# Start Analytics Service Locally
# Usage: .\start-analytics.ps1

Write-Host "Starting PropertyIQ Analytics Service on http://localhost:8000..." -ForegroundColor Cyan
Write-Host ""

# Navigate to analytics directory
cd packages\propertyiq-analytics

# Check if venv exists
if (-Not (Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate venv
Write-Host "Activating virtual environment..." -ForegroundColor Green
& .\venv\Scripts\Activate.ps1

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Green
pip install -r requirements.txt --quiet

# Start server
Write-Host ""
Write-Host "Starting FastAPI server..." -ForegroundColor Green
Write-Host "Visit http://localhost:8000/docs for API documentation" -ForegroundColor Cyan
Write-Host ""
uvicorn app.main:app --reload --port 8000
