# ============================================================================
# Download ALL 2024 TIGER Shapefiles
# Downloads: National, State, Metro, All Cities, ZIP Codes
# ============================================================================

$Year = "2024"
$BaseUrl = "https://www2.census.gov/geo/tiger/TIGER$Year"
$OutputDir = ".\shapefiles"
$CartographicUrl = "https://www2.census.gov/geo/tiger/GENZ$Year/shp"

Write-Host "========================================" -ForegroundColor Green
Write-Host "2024 TIGER Shapefile Downloader" -ForegroundColor Green  
Write-Host "========================================" -ForegroundColor Green
Write-Host "This will download:" -ForegroundColor Yellow
Write-Host "  - National boundaries" -ForegroundColor White
Write-Host "  - All states" -ForegroundColor White
Write-Host "  - All metros (CBSAs)" -ForegroundColor White
Write-Host "  - All cities (56 state files)" -ForegroundColor White
Write-Host "  - ZIP codes (~500MB)" -ForegroundColor White
Write-Host "Total download size: ~1-2 GB" -ForegroundColor Yellow
Write-Host ""

# Auto-confirm for non-interactive execution
$confirm = "yes"
Write-Host "Proceeding with download..." -ForegroundColor Green

# Create output directory
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Host "Created directory: $OutputDir" -ForegroundColor Yellow
}

Set-Location $OutputDir

# Function to download and extract
function Download-AndExtract {
    param(
        [string]$Name,
        [string]$Url,
        [string]$FileName
    )
    
    Write-Host "`n[$Name]" -ForegroundColor Cyan
    Write-Host "  Downloading: $FileName" -ForegroundColor Gray
    
    if (Test-Path $FileName) {
        Write-Host "  ✓ File already exists, skipping download" -ForegroundColor Green
        
        # Check if extracted
        $shpFile = $FileName -replace '\.zip$', '.shp'
        if (Test-Path $shpFile) {
            Write-Host "  ✓ Already extracted" -ForegroundColor Green
            return $true
        }
    }
    else {
        try {
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -Uri "$Url/$FileName" -OutFile $FileName -UseBasicParsing -ErrorAction Stop
            $ProgressPreference = 'Continue'
            
            $sizeMB = [math]::Round((Get-Item $FileName).Length / 1MB, 2)
            Write-Host "  ✓ Downloaded ($sizeMB MB)" -ForegroundColor Green
        }
        catch {
            Write-Host "  ✗ Failed to download: $_" -ForegroundColor Red
            return $false
        }
    }
    
    # Extract
    try {
        Write-Host "  Extracting..." -ForegroundColor Gray
        Expand-Archive -Path $FileName -DestinationPath "." -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ Extracted" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "  ⚠ Extraction warning: $_" -ForegroundColor Yellow
        return $true
    }
}

# State FIPS codes (01-56)
$stateFips = @(
    "01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
    "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
    "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
    "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
    "45", "46", "47", "48", "49", "50", "51", "53", "54", "55", "56"
)

$startTime = Get-Date
$successCount = 0
$failCount = 0

# ============================================================================
# 1. NATIONAL
# ============================================================================
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "[1/5] NATIONAL BOUNDARIES" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Try TIGER/Line first
$result = Download-AndExtract -Name "National (TIGER)" -Url "$BaseUrl/NATION" -FileName "tl_${Year}_us_nation.zip"
if ($result) { $successCount++ } else { $failCount++ }

# Try Cartographic Boundary (simplified)
$result = Download-AndExtract -Name "National (Cartographic)" -Url $CartographicUrl -FileName "cb_${Year}_us_nation_5m.zip"
if ($result) { $successCount++ } else { $failCount++ }

# ============================================================================
# 2. STATES
# ============================================================================
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "[2/5] STATES" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$result = Download-AndExtract -Name "All States" -Url "$BaseUrl/STATE" -FileName "tl_${Year}_us_state.zip"
if ($result) { $successCount++ } else { $failCount++ }

# ============================================================================
# 3. METROS (CBSAs)
# ============================================================================
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "[3/5] METROPOLITAN AREAS (CBSAs)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$result = Download-AndExtract -Name "Metropolitan Statistical Areas" -Url "$BaseUrl/CBSA" -FileName "tl_${Year}_us_cbsa.zip"
if ($result) { $successCount++ } else { $failCount++ }

# ============================================================================
# 4. CITIES (PLACES) - All 56 states
# ============================================================================
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "[4/5] CITIES (PLACES) - All States" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Downloading 56 state files..." -ForegroundColor Yellow

$citySuccess = 0
$cityFail = 0

foreach ($fips in $stateFips) {
    $fileName = "tl_${Year}_${fips}_place.zip"
    $result = Download-AndExtract -Name "State $fips Cities" -Url "$BaseUrl/PLACE" -FileName $fileName
    if ($result) { 
        $citySuccess++
        $successCount++
    } else { 
        $cityFail++
        $failCount++
    }
    
    # Show progress every 10 files
    if (($citySuccess + $cityFail) % 10 -eq 0) {
        Write-Host "  Progress: $($citySuccess + $cityFail)/56 files" -ForegroundColor Cyan
    }
}

Write-Host "`n  Cities Summary: $citySuccess succeeded, $cityFail failed" -ForegroundColor $(if ($cityFail -eq 0) { "Green" } else { "Yellow" })

# ============================================================================
# 5. ZIP CODES
# ============================================================================
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "[5/5] ZIP CODES" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Warning: ZIP code file is very large (~500MB compressed, ~2GB extracted)" -ForegroundColor Yellow

# Auto-confirm ZIP code download
$response = "y"
Write-Host "Downloading ZIP codes..." -ForegroundColor Green
if ($response -match '^[Yy]') {
    $result = Download-AndExtract -Name "ZIP Code Tabulation Areas" -Url "$BaseUrl/ZCTA520" -FileName "tl_${Year}_us_zcta520.zip"
    if ($result) { $successCount++ } else { $failCount++ }
}
else {
    Write-Host "Skipping ZIP codes" -ForegroundColor Yellow
}

# ============================================================================
# Summary
# ============================================================================
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Download Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

Write-Host "`nSummary:" -ForegroundColor Yellow
Write-Host "  Successful downloads: $successCount" -ForegroundColor Green
Write-Host "  Failed downloads: $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host "  Total time: $([math]::Round($duration.TotalMinutes, 2)) minutes" -ForegroundColor Cyan

$currentPath = Get-Location
Write-Host "`nFiles downloaded to: $currentPath" -ForegroundColor Cyan

# Show downloaded files
Write-Host "`nDownloaded ZIP files:" -ForegroundColor Yellow
$zipFiles = Get-ChildItem -Filter "*.zip" | Where-Object { $_.Name -match "^tl_2024|^cb_2024" }
$totalSize = 0
foreach ($file in $zipFiles) {
    $sizeMB = [math]::Round($file.Length / 1MB, 2)
    $totalSize += $file.Length
    Write-Host "  $($file.Name): $sizeMB MB" -ForegroundColor Gray
}
$totalSizeMB = [math]::Round($totalSize / 1MB, 2)
Write-Host "  Total: $totalSizeMB MB" -ForegroundColor Cyan

# Check for shapefiles
$shpFiles = Get-ChildItem -Filter "*.shp" | Where-Object { $_.Name -match "^tl_2024|^cb_2024" }
if ($shpFiles.Count -gt 0) {
    Write-Host "`nExtracted shapefiles: $($shpFiles.Count) files" -ForegroundColor Green
}

Write-Host "`nNext steps:" -ForegroundColor Green
Write-Host "1. Convert shapefiles to GeoJSON if needed" -ForegroundColor White
Write-Host "2. Load into your PostgreSQL database" -ForegroundColor White
Write-Host "3. Use for geographic mapping and data visualization" -ForegroundColor White

# Return to parent directory
Set-Location ..

Write-Host "`nScript complete!" -ForegroundColor Green


