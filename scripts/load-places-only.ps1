# Load all place (city) files to Supabase
# This loads all state-specific place files into the tiger_places table

$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$projectRef = "pysflbhpnqwoczyuaaif"
$geometryColumn = "geometry"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Load All Place (City) Files" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get all place files
$placeFiles = Get-ChildItem -Path "scripts/geojson" -Filter "tl_2024_*_place.geojson" | Sort-Object Name

Write-Host "Found $($placeFiles.Count) place files to load" -ForegroundColor Yellow
Write-Host ""

$fileNum = 0
foreach ($placeFile in $placeFiles) {
    $fileNum++
    $stateCode = $placeFile.Name -replace 'tl_2024_(\d+)_place\.geojson', '$1'
    
    Write-Host "[$fileNum/$($placeFiles.Count)] Loading: State $stateCode" -ForegroundColor Cyan
    Write-Host "  File: $($placeFile.Name)" -ForegroundColor Gray
    
    npm run load-shapefiles -- --file "scripts/geojson/$($placeFile.Name)" --table "tiger_places" --project-ref $projectRef --geometry-column $geometryColumn --geoid-field "GEOID"
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All Place Files Processed!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan




