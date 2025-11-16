# Load ALL geographic data to Supabase
# Simple version that runs each load sequentially

$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTM3MzUsImV4cCI6MjA3ODE4OTczNX0.txaMHdCFyL_X1fi3-_gzcaMENjxGFHASGsBS_RnCLWc"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$projectRef = "pysflbhpnqwoczyuaaif"
$geometryColumn = "geometry"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Load ALL Geographic Data to Supabase" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Define all files to load
$filesToLoad = @()

# 1. National
$filesToLoad += @{ file = "scripts/geojson/cb_2024_us_nation_5m.geojson"; table = "tiger_nation"; geoid = "GEOID"; desc = "Nation" }

# 2. States (skip if already loaded, but will update)
$filesToLoad += @{ file = "scripts/geojson/tl_2024_us_state.geojson"; table = "tiger_states"; geoid = "GEOID"; desc = "States" }

# 3. Counties
$filesToLoad += @{ file = "scripts/geojson/tl_2024_us_county.geojson"; table = "tiger_counties"; geoid = "GEOID"; desc = "Counties" }

# 4. CBSA (Metro Areas)
$filesToLoad += @{ file = "scripts/geojson/tl_2024_us_cbsa.geojson"; table = "tiger_cbsa"; geoid = "GEOID"; desc = "CBSA (Metro)" }

# 5. Metro Divisions
if (Test-Path "data/tiger/tl_2024_us_metdiv.shp") {
    $filesToLoad += @{ file = "data/tiger/tl_2024_us_metdiv.shp"; table = "tiger_metdiv"; geoid = "GEOID"; desc = "Metro Divisions" }
}

# 6. CSA
if (Test-Path "data/tiger/tl_2024_us_csa.shp") {
    $filesToLoad += @{ file = "data/tiger/tl_2024_us_csa.shp"; table = "tiger_csa"; geoid = "GEOID"; desc = "CSA" }
}

# 7. Urban Areas
if (Test-Path "data/tiger/tl_2024_us_uac20.shp") {
    $filesToLoad += @{ file = "data/tiger/tl_2024_us_uac20.shp"; table = "tiger_urban_areas"; geoid = "GEOID20"; desc = "Urban Areas" }
}

# 8. ZCTA (Zip Codes)
$filesToLoad += @{ file = "scripts/geojson/tl_2024_us_zcta520.geojson"; table = "tiger_zcta"; geoid = "GEOID20"; desc = "ZCTA (Zip Codes)" }

# 9. Places (Cities) - All state files
$placeFiles = Get-ChildItem -Path "scripts/geojson" -Filter "tl_2024_*_place.geojson" | Sort-Object Name
foreach ($placeFile in $placeFiles) {
    $stateCode = $placeFile.Name -replace 'tl_2024_(\d+)_place\.geojson', '$1'
    $filesToLoad += @{ file = "scripts/geojson/$($placeFile.Name)"; table = "tiger_places"; geoid = "GEOID"; desc = "Places (State $stateCode)" }
}

Write-Host "Found $($filesToLoad.Count) files to load" -ForegroundColor Yellow
Write-Host ""

$fileNum = 0
foreach ($item in $filesToLoad) {
    $fileNum++
    $filePath = Join-Path $projectRoot $item.file
    
    if (Test-Path $filePath) {
        Write-Host "[$fileNum/$($filesToLoad.Count)] Loading: $($item.desc)" -ForegroundColor Cyan
        Write-Host "  File: $($item.file)" -ForegroundColor Gray
        
        npm run load-shapefiles -- --file $item.file --table $item.table --project-ref $projectRef --geometry-column $geometryColumn --geoid-field $item.geoid
        
        Write-Host ""
    } else {
        Write-Host "[$fileNum/$($filesToLoad.Count)] ⚠️  File not found: $($item.file)" -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All Files Processed!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan




