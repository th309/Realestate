# Load All TIGER Shapefiles and GeoJSON Files to Supabase
# This script loads all geographic data into the database

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectRef = "pysflbhpnqwoczyuaaif",
    
    [Parameter(Mandatory=$false)]
    [string]$DbPassword
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

Write-Info "================================================"
Write-Info "   Load All TIGER Data to Supabase"
Write-Info "================================================"
Write-Host ""

# Get database password if not provided
if (-not $DbPassword) {
    Write-Warning "Database password required"
    $securePassword = Read-Host "Enter your Supabase database password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $DbPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# Connection parameters
$host = "db.$ProjectRef.supabase.co"
$dbname = "postgres"
$user = "postgres"
$port = "5432"
$connectionString = "PG:host=$host dbname=$dbname user=$user password=$DbPassword port=$port sslmode=require"

# Check if ogr2ogr is available
$ogr2ogr = Get-Command ogr2ogr -ErrorAction SilentlyContinue
if (-not $ogr2ogr) {
    Write-Error "ogr2ogr not found. Please install GDAL:"
    Write-Warning "  Windows: choco install gdal"
    Write-Warning "  Or download from: https://gdal.org/download.html"
    exit 1
}

Write-Success "✓ ogr2ogr found"

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$tigerDir = $scriptDir
$geojsonDir = Join-Path (Split-Path -Parent $scriptDir) "scripts\geojson"

Write-Info "TIGER directory: $tigerDir"
Write-Info "GeoJSON directory: $geojsonDir"
Write-Host ""

# Function to load shapefile or GeoJSON
function Load-GeographicFile {
    param(
        [string]$FilePath,
        [string]$TableName,
        [string]$GeoidField = "GEOID",
        [string]$FileType = "shapefile"
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-Warning "  ⚠ File not found: $FilePath"
        return $false
    }
    
    $fileName = Split-Path -Leaf $FilePath
    Write-Info "Loading: $fileName → $TableName"
    Write-Host "  Source: $FilePath" -ForegroundColor Gray
    
    try {
        # Use ogr2ogr to load file
        $ogrCommand = "ogr2ogr -f PostgreSQL `"$connectionString`" `"$FilePath`" -nln $TableName -nlt PROMOTE_TO_MULTI -lco GEOMETRY_NAME=geometry -t_srs EPSG:4326 -overwrite -progress"
        
        $result = Invoke-Expression $ogrCommand 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "  ✓ Loaded successfully"
            return $true
        } else {
            Write-Error "  ✗ Failed: $result"
            return $false
        }
    } catch {
        Write-Error "  ✗ Error: $_"
        return $false
    }
}

# Track progress
$loaded = 0
$failed = 0
$skipped = 0

Write-Info "Loading national-level shapefiles..."
Write-Host ""

# 1. States
if (Load-GeographicFile -FilePath "$tigerDir\tl_2024_us_state.shp" -TableName "tiger_states" -GeoidField "GEOID") {
    $loaded++
} else {
    $failed++
}

# 2. Counties
if (Load-GeographicFile -FilePath "$tigerDir\tl_2024_us_county.shp" -TableName "tiger_counties" -GeoidField "GEOID") {
    $loaded++
} else {
    $failed++
}

# 3. CBSA
if (Load-GeographicFile -FilePath "$tigerDir\tl_2024_us_cbsa.shp" -TableName "tiger_cbsa" -GeoidField "GEOID") {
    $loaded++
} else {
    $failed++
}

# 4. ZCTA
if (Load-GeographicFile -FilePath "$tigerDir\tl_2024_us_zcta520.shp" -TableName "tiger_zcta" -GeoidField "GEOID20") {
    $loaded++
} else {
    $failed++
}

# 5. Urban Areas
if (Test-Path "$tigerDir\tl_2024_us_uac20.shp") {
    if (Load-GeographicFile -FilePath "$tigerDir\tl_2024_us_uac20.shp" -TableName "tiger_urban_areas" -GeoidField "GEOID20") {
        $loaded++
    } else {
        $failed++
    }
}

# 6. Combined Statistical Areas
if (Test-Path "$tigerDir\tl_2024_us_csa.shp") {
    if (Load-GeographicFile -FilePath "$tigerDir\tl_2024_us_csa.shp" -TableName "tiger_csa" -GeoidField "GEOID") {
        $loaded++
    } else {
        $failed++
    }
}

# 7. Metropolitan Divisions
if (Test-Path "$tigerDir\tl_2024_us_metdiv.shp") {
    if (Load-GeographicFile -FilePath "$tigerDir\tl_2024_us_metdiv.shp" -TableName "tiger_metdiv" -GeoidField "GEOID") {
        $loaded++
    } else {
        $failed++
    }
}

Write-Host ""
Write-Info "Loading Places (51 state files)..."
Write-Host ""

# 8. Places - Load all state place files into a single table
$placeFiles = Get-ChildItem -Path $tigerDir -Filter "tl_2024_*_place.shp" | Sort-Object Name
$placeCount = 0

foreach ($placeFile in $placeFiles) {
    $placeCount++
    Write-Host "[$placeCount/$($placeFiles.Count)] Loading $($placeFile.Name)..." -ForegroundColor Gray
    
    # For the first file, create the table. For subsequent files, append.
    if ($placeCount -eq 1) {
        if (Load-GeographicFile -FilePath $placeFile.FullName -TableName "tiger_places" -GeoidField "GEOID") {
            $loaded++
        } else {
            $failed++
        }
    } else {
        # Append to existing table
        try {
            $ogrCommand = "ogr2ogr -f PostgreSQL `"$connectionString`" `"$($placeFile.FullName)`" -nln tiger_places -append -nlt PROMOTE_TO_MULTI -lco GEOMETRY_NAME=geometry -t_srs EPSG:4326 -progress"
            $result = Invoke-Expression $ogrCommand 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "  ✓ Appended"
                $loaded++
            } else {
                Write-Error "  ✗ Failed to append"
                $failed++
            }
        } catch {
            Write-Error "  ✗ Error: $_"
            $failed++
        }
    }
}

Write-Host ""
Write-Info "Loading GeoJSON files (if available)..."
Write-Host ""

# Load GeoJSON files (these are likely already converted, but load if needed)
if (Test-Path $geojsonDir) {
    $geojsonFiles = Get-ChildItem -Path $geojsonDir -Filter "*.geojson"
    
    if ($geojsonFiles.Count -gt 0) {
        Write-Info "Found $($geojsonFiles.Count) GeoJSON files"
        Write-Warning "Note: GeoJSON files are typically already converted from shapefiles."
        Write-Warning "Skipping GeoJSON load (shapefiles are the source of truth)."
        $skipped = $geojsonFiles.Count
    }
}

Write-Host ""
Write-Info "================================================"
Write-Info "                Summary"
Write-Info "================================================"
Write-Success "✓ Loaded: $loaded file(s)"
if ($failed -gt 0) {
    Write-Error "✗ Failed: $failed file(s)"
}
if ($skipped -gt 0) {
    Write-Warning "⊘ Skipped: $skipped GeoJSON file(s)"
}

Write-Host ""
Write-Info "Next steps:"
Write-Info "1. Update GEOID fields: Run SQL: SELECT update_tiger_geoids();"
Write-Info "2. Extract names from attributes"
Write-Info "3. Run relationship calculations"
Write-Info "4. Build hierarchy table"
Write-Host ""

