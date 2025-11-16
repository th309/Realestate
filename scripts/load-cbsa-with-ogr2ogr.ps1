# Load CBSA shapefile into PostgreSQL using ogr2ogr
# Requires GDAL/OGR to be installed

param(
    [string]$ShapefilePath = "shapefiles\tl_2024_us_cbsa.shp",
    [string]$TableName = "dim_geography_geometry_staging"
)

# Load environment variables from .env.local
$envFile = Join-Path $PSScriptRoot "..\web\.env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Get Supabase URL
$supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
if (-not $supabaseUrl) {
    Write-Host "Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local" -ForegroundColor Red
    Write-Host "Please ensure your .env.local file contains NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor Yellow
    exit 1
}

# Extract project reference from Supabase URL
# Format: https://xxxxx.supabase.co
if ($supabaseUrl -match 'https://([^.]+)\.supabase\.co') {
    $projectRef = $matches[1]
} else {
    Write-Host "Error: Could not parse Supabase URL: $supabaseUrl" -ForegroundColor Red
    exit 1
}

# Supabase PostgreSQL connection details
# You'll need to get the database password from Supabase Dashboard > Settings > Database
Write-Host "Supabase Project Reference: $projectRef" -ForegroundColor Cyan
Write-Host ""
Write-Host "To get your database password:" -ForegroundColor Yellow
Write-Host "1. Go to https://supabase.com/dashboard/project/$projectRef/settings/database" -ForegroundColor Yellow
Write-Host "2. Copy the 'Connection string' under 'Connection parameters'" -ForegroundColor Yellow
Write-Host "   OR use the 'Connection pooling' string" -ForegroundColor Yellow
Write-Host ""
Write-Host "Enter your database password (or press Enter to use connection string):" -ForegroundColor Cyan
$dbPassword = Read-Host -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword)
)

if ([string]::IsNullOrWhiteSpace($dbPasswordPlain)) {
    Write-Host "Enter full PostgreSQL connection string:" -ForegroundColor Cyan
    $connectionString = Read-Host
} else {
    # Construct connection string
    $dbHost = "db.$projectRef.supabase.co"
    $dbname = "postgres"
    $user = "postgres"
    $port = "5432"
    
    $connectionString = "PG:host=$dbHost dbname=$dbname user=$user password=$dbPasswordPlain port=$port sslmode=require"
}

# Full path to shapefile
$fullShapefilePath = Join-Path $PSScriptRoot $ShapefilePath
if (-not (Test-Path $fullShapefilePath)) {
    Write-Host "Error: Shapefile not found: $fullShapefilePath" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Loading CBSA shapefile into PostgreSQL..." -ForegroundColor Green
Write-Host "  Shapefile: $fullShapefilePath" -ForegroundColor Gray
Write-Host "  Table: $TableName" -ForegroundColor Gray
Write-Host ""

# Check if ogr2ogr is available
$ogr2ogr = Get-Command ogr2ogr -ErrorAction SilentlyContinue
if (-not $ogr2ogr) {
    Write-Host "Error: ogr2ogr not found. Please install GDAL:" -ForegroundColor Red
    Write-Host "  Windows: choco install gdal" -ForegroundColor Yellow
    Write-Host "  Or download from: https://gdal.org/download.html" -ForegroundColor Yellow
    exit 1
}

# Run ogr2ogr
$ogrCommand = "ogr2ogr -f PostgreSQL `"$connectionString`" `"$fullShapefilePath`" -nln $TableName -nlt PROMOTE_TO_MULTI -lco GEOMETRY_NAME=geom -t_srs EPSG:4326 -overwrite"

Write-Host "Running: ogr2ogr ..." -ForegroundColor Cyan
Write-Host ""

try {
    Invoke-Expression $ogrCommand
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Successfully loaded CBSA shapefile into $TableName" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Verify data: SELECT COUNT(*) FROM $TableName;" -ForegroundColor Gray
        Write-Host "2. Copy to dim_geography_geometry with proper geoid mapping" -ForegroundColor Gray
    } else {
        Write-Host ""
        Write-Host "❌ ogr2ogr failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error running ogr2ogr: $_" -ForegroundColor Red
    exit 1
}








