# Load TIGER Shapefiles into Supabase PostgreSQL
# Requires: GDAL/OGR2OGR installed

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
Write-Info "   Load TIGER Shapefiles to Supabase"
Write-Info "================================================"
Write-Host ""

# Get database password if not provided
if (-not $DbPassword) {
    Write-Warning "Database password required"
    $DbPassword = Read-Host "Enter your Supabase database password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbPassword)
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

Write-Info "Working directory: $tigerDir"
Write-Host ""

# Function to load shapefile
function Load-Shapefile {
    param(
        [string]$ShapefilePath,
        [string]$TableName,
        [string]$GeoidField = "GEOID"
    )
    
    if (-not (Test-Path $ShapefilePath)) {
        Write-Warning "  ⚠ Shapefile not found: $ShapefilePath"
        return $false
    }
    
    Write-Info "Loading: $TableName"
    Write-Host "  Source: $ShapefilePath" -ForegroundColor Gray
    
    try {
        # Use ogr2ogr to load shapefile
        $ogrCommand = "ogr2ogr -f PostgreSQL `"$connectionString`" `"$ShapefilePath`" -nln $TableName -nlt PROMOTE_TO_MULTI -lco GEOMETRY_NAME=geometry -t_srs EPSG:4326 -overwrite -progress"
        
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

# Load shapefiles
Write-Info "Loading TIGER shapefiles..."
Write-Host ""

$loaded = 0
$failed = 0

# 1. States
if (Load-Shapefile -ShapefilePath "$tigerDir\tl_2024_us_state.shp" -TableName "tiger_states" -GeoidField "GEOID") {
    $loaded++
} else {
    $failed++
}

# 2. Counties
if (Load-Shapefile -ShapefilePath "$tigerDir\tl_2024_us_county.shp" -TableName "tiger_counties" -GeoidField "GEOID") {
    $loaded++
} else {
    $failed++
}

# 3. CBSA
if (Load-Shapefile -ShapefilePath "$tigerDir\tl_2024_us_cbsa.shp" -TableName "tiger_cbsa" -GeoidField "GEOID") {
    $loaded++
} else {
    $failed++
}

# 4. ZCTA
if (Load-Shapefile -ShapefilePath "$tigerDir\tl_2024_us_zcta520.shp" -TableName "tiger_zcta" -GeoidField "GEOID20") {
    $loaded++
} else {
    $failed++
}

# 5. Places - need to load all state place files
Write-Info "Loading Places (this may take a while)..."
$placeFiles = Get-ChildItem -Path $tigerDir -Filter "tl_2024_*_place.shp"
if ($placeFiles.Count -gt 0) {
    Write-Host "  Found $($placeFiles.Count) place files" -ForegroundColor Gray
    
    # Create temporary merged table or load individually
    # For now, we'll need to merge them or load into a staging table first
    Write-Warning "  Note: Place files need to be merged. Loading first file as test..."
    
    if (Load-Shapefile -ShapefilePath $placeFiles[0].FullName -TableName "tiger_places" -GeoidField "GEOID") {
        $loaded++
        Write-Warning "  ⚠ Only loaded first place file. Need to merge remaining $($placeFiles.Count - 1) files."
    } else {
        $failed++
    }
} else {
    Write-Warning "  ⚠ No place files found"
    $failed++
}

Write-Host ""
Write-Info "================================================"
Write-Info "                Summary"
Write-Info "================================================"
Write-Success "✓ Loaded: $loaded file(s)"
if ($failed -gt 0) {
    Write-Error "✗ Failed: $failed file(s)"
}

Write-Host ""
Write-Info "Next steps:"
Write-Info "1. Update GEOID fields in loaded tables"
Write-Info "2. Run build-geographic-relationships.sql"
Write-Info "3. Run build-geo-hierarchy-table.sql"
Write-Host ""

