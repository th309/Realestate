# Load ALL geographic data to Supabase
# This script loads national, state, county, metro, city, zip code, and other geographic data

# Use service role key for admin operations (INSERT permissions)
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I"

# Also set anon key as fallback
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTM3MzUsImV4cCI6MjA3ODE4OTczNX0.txaMHdCFyL_X1fi3-_gzcaMENjxGFHASGsBS_RnCLWc"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$projectRef = "pysflbhpnqwoczyuaaif"
$geometryColumn = "geometry"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Load ALL Geographic Data to Supabase" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$totalLoaded = 0
$totalErrors = 0
$filesToLoad = @()

# 1. National level
$filesToLoad += @(
    @{ 
        file = "scripts/geojson/cb_2024_us_nation_5m.geojson"; 
        table = "tiger_nation"; 
        geoid = "GEOID";
        description = "Nation (United States)"
    }
)

# 2. States (already loaded, but include for completeness)
$filesToLoad += @(
    @{ 
        file = "scripts/geojson/tl_2024_us_state.geojson"; 
        table = "tiger_states"; 
        geoid = "GEOID";
        description = "States"
    }
)

# 3. Counties
$filesToLoad += @(
    @{ 
        file = "scripts/geojson/tl_2024_us_county.geojson"; 
        table = "tiger_counties"; 
        geoid = "GEOID";
        description = "Counties"
    }
)

# 4. CBSA (Metropolitan/Micropolitan Statistical Areas)
$filesToLoad += @(
    @{ 
        file = "scripts/geojson/tl_2024_us_cbsa.geojson"; 
        table = "tiger_cbsa"; 
        geoid = "GEOID";
        description = "CBSA (Metro Areas)"
    }
)

# 5. Metro Divisions (if GeoJSON exists, otherwise use shapefile)
if (Test-Path "data/tiger/tl_2024_us_metdiv.shp") {
    $filesToLoad += @(
        @{ 
            file = "data/tiger/tl_2024_us_metdiv.shp"; 
            table = "tiger_metdiv"; 
            geoid = "GEOID";
            description = "Metro Divisions"
        }
    )
}

# 6. CSA (Combined Statistical Areas)
if (Test-Path "data/tiger/tl_2024_us_csa.shp") {
    $filesToLoad += @(
        @{ 
            file = "data/tiger/tl_2024_us_csa.shp"; 
            table = "tiger_csa"; 
            geoid = "GEOID";
            description = "CSA (Combined Statistical Areas)"
        }
    )
}

# 7. Urban Areas
if (Test-Path "data/tiger/tl_2024_us_uac20.shp") {
    $filesToLoad += @(
        @{ 
            file = "data/tiger/tl_2024_us_uac20.shp"; 
            table = "tiger_urban_areas"; 
            geoid = "GEOID20";
            description = "Urban Areas"
        }
    )
}

# 8. ZCTA (Zip Code Tabulation Areas)
$filesToLoad += @(
    @{ 
        file = "scripts/geojson/tl_2024_us_zcta520.geojson"; 
        table = "tiger_zcta"; 
        geoid = "GEOID20";
        description = "ZCTA (Zip Codes)"
    }
)

# 9. Places (Cities) - All state files
$placeFiles = Get-ChildItem -Path "scripts/geojson" -Filter "tl_2024_*_place.geojson" | Sort-Object Name
foreach ($placeFile in $placeFiles) {
    $stateCode = $placeFile.Name -replace 'tl_2024_(\d+)_place\.geojson', '$1'
    $filesToLoad += @(
        @{ 
            file = "scripts/geojson/$($placeFile.Name)"; 
            table = "tiger_places"; 
            geoid = "GEOID";
            description = "Places (State: $stateCode)"
        }
    )
}

Write-Host "Found $($filesToLoad.Count) files to load" -ForegroundColor Yellow
Write-Host ""

# Load each file
foreach ($item in $filesToLoad) {
    $filePath = Join-Path $projectRoot $item.file
    
    if (Test-Path $filePath) {
        Write-Host "Loading: $($item.description)" -ForegroundColor Yellow
        Write-Host "  File: $($item.file)" -ForegroundColor Gray
        Write-Host "  Table: $($item.table)" -ForegroundColor Gray
        
        # Run the load command and capture output
        $output = npm run load-shapefiles -- --file $item.file --table $item.table --project-ref $projectRef --geometry-column $geometryColumn --geoid-field $item.geoid 2>&1 | Out-String
        
        # Parse output for success/failure
        $loaded = 0
        $errors = 0
        
        if ($output -match "Loaded:\s*(\d+).*Errors:\s*(\d+)") {
            $loaded = [int]$matches[1]
            $errors = [int]$matches[2]
            $totalLoaded += $loaded
            $totalErrors += $errors
            
            if ($errors -eq 0) {
                Write-Host "  ✅ Success: $loaded records loaded" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  Partial: $loaded loaded, $errors errors" -ForegroundColor Yellow
            }
        } elseif ($output -match "Complete!") {
            Write-Host "  ✅ Completed" -ForegroundColor Green
        } else {
            # Try to extract any error messages
            if ($output -match "Error|Failed|❌") {
                Write-Host "  ❌ Failed - check output above" -ForegroundColor Red
                $totalErrors++
            } else {
                Write-Host "  ✅ Completed (output format not recognized)" -ForegroundColor Green
            }
        }
        
        Write-Host ""
    } else {
        Write-Host "⚠️  File not found: $($item.file)" -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Loading Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total files processed: $($filesToLoad.Count)" -ForegroundColor Cyan
Write-Host "Total records loaded: $totalLoaded" -ForegroundColor Green
if ($totalErrors -gt 0) {
    Write-Host "Total errors: $totalErrors" -ForegroundColor Yellow
}

