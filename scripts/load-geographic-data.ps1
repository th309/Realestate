# Load geographic data to Supabase using the Node.js script
# This script sets environment variables and runs the loader

# Use service role key for admin operations (INSERT permissions)
$env:SUPABASE_SERVICE_ROLE_KEY = 

# Also set anon key as fallback
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTM3MzUsImV4cCI6MjA3ODE4OTczNX0.txaMHdCFyL_X1fi3-_gzcaMENjxGFHASGsBS_RnCLWc"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Load Geographic Data to Supabase" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load main national files
$files = @(
    @{ file = "scripts/geojson/tl_2024_us_state.geojson"; table = "tiger_states"; geoid = "GEOID" },
    @{ file = "scripts/geojson/tl_2024_us_county.geojson"; table = "tiger_counties"; geoid = "GEOID" },
    @{ file = "scripts/geojson/tl_2024_us_cbsa.geojson"; table = "tiger_cbsa"; geoid = "GEOID" },
    @{ file = "scripts/geojson/tl_2024_us_zcta520.geojson"; table = "tiger_zcta"; geoid = "GEOID20" }
)

foreach ($item in $files) {
    $filePath = Join-Path $projectRoot $item.file
    if (Test-Path $filePath) {
        Write-Host "Loading: $($item.file)" -ForegroundColor Yellow
        npm run load-shapefiles -- --file $item.file --table $item.table --project-ref "pysflbhpnqwoczyuaaif" --geometry-column "geometry" --geoid-field $item.geoid
        Write-Host ""
    } else {
        Write-Host "File not found: $($item.file)" -ForegroundColor Red
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Loading Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

