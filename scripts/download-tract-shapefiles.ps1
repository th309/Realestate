# ============================================================================
# Download Census Tract Shapefiles (2024)
# Downloads tract boundaries for all 50 states + DC + territories
# ============================================================================

$Year = "2024"
$BaseUrl = "https://www2.census.gov/geo/tiger/TIGER$Year"
$OutputDir = ".\shapefiles"

Write-Host "========================================" -ForegroundColor Green
Write-Host "2024 Census Tract Shapefile Downloader" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

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
        Write-Host "  File already exists, skipping download" -ForegroundColor Green

        # Check if extracted
        $shpFile = $FileName -replace '\.zip$', '.shp'
        if (Test-Path $shpFile) {
            Write-Host "  Already extracted" -ForegroundColor Green
            return $true
        }
    }
    else {
        try {
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -Uri "$Url/$FileName" -OutFile $FileName -UseBasicParsing -ErrorAction Stop
            $ProgressPreference = 'Continue'

            $sizeMB = [math]::Round((Get-Item $FileName).Length / 1MB, 2)
            Write-Host "  Downloaded ($sizeMB MB)" -ForegroundColor Green
        }
        catch {
            Write-Host "  Failed to download: $_" -ForegroundColor Red
            return $false
        }
    }

    # Extract
    try {
        Write-Host "  Extracting..." -ForegroundColor Gray
        Expand-Archive -Path $FileName -DestinationPath "." -Force -ErrorAction SilentlyContinue
        Write-Host "  Extracted" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "  Extraction warning: $_" -ForegroundColor Yellow
        return $true
    }
}

# State FIPS codes (all 50 states + DC + territories)
$stateFips = @(
    "01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
    "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
    "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
    "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
    "45", "46", "47", "48", "49", "50", "51", "53", "54", "55", "56",
    "60", "66", "69", "72", "78"  # AS, GU, MP, PR, VI
)

$startTime = Get-Date
$successCount = 0
$failCount = 0

Write-Host "`nDownloading tract shapefiles for all states..." -ForegroundColor Yellow

foreach ($fips in $stateFips) {
    $fileName = "tl_${Year}_${fips}_tract.zip"
    $result = Download-AndExtract -Name "State $fips Tracts" -Url "$BaseUrl/TRACT" -FileName $fileName
    if ($result) {
        $successCount++
    } else {
        $failCount++
    }

    # Show progress every 10 files
    if (($successCount + $failCount) % 10 -eq 0) {
        Write-Host "  Progress: $($successCount + $failCount)/$($stateFips.Count) files" -ForegroundColor Cyan
    }
}

# Summary
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Download Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

Write-Host "`nSummary:" -ForegroundColor Yellow
Write-Host "  Successful downloads: $successCount" -ForegroundColor Green
Write-Host "  Failed downloads: $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host "  Total time: $([math]::Round($duration.TotalMinutes, 2)) minutes" -ForegroundColor Cyan

# Return to parent directory
Set-Location ..

Write-Host "`nNext step: Run convert-places-and-tracts-to-geojson.ts" -ForegroundColor Green
