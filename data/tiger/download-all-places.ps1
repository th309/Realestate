# Download all TIGER 2024 Place files for all US states
# This script downloads place shapefiles for all 50 states + DC

$baseUrl = "https://www2.census.gov/geo/tiger/TIGER2024/PLACE"
$outputDir = "C:\Projects\Real Estate\data\tiger"

# All US state FIPS codes (including DC)
$stateFips = @(
    "01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
    "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
    "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
    "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
    "45", "46", "47", "48", "49", "50", "51", "53", "54", "55", "56"
)

Write-Host "Downloading all place files for all US states..." -ForegroundColor Cyan
Write-Host "Total states: $($stateFips.Count)" -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($fips in $stateFips) {
    $url = "$baseUrl/tl_2024_${fips}_place.zip"
    $filename = "tl_2024_${fips}_place.zip"
    $filepath = Join-Path $outputDir $filename
    
    # Skip if already downloaded
    if (Test-Path $filepath) {
        Write-Host "✓ Already exists: $filename" -ForegroundColor Gray
        $successCount++
        continue
    }
    
    Write-Host "Downloading FIPS $fips..." -ForegroundColor Yellow
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $filepath -ErrorAction Stop
        Write-Host "  ✓ Downloaded: $filename" -ForegroundColor Green
        
        # Extract immediately
        Expand-Archive -Path $filepath -DestinationPath $outputDir -Force
        Write-Host "  ✓ Extracted: $filename" -ForegroundColor Green
        
        $successCount++
    } catch {
        Write-Host "  ✗ Failed: $filename - $_" -ForegroundColor Red
        $failCount++
    }
    
    # Small delay to be respectful to the server
    Start-Sleep -Milliseconds 200
}

Write-Host ""
Write-Host "=" * 50 -ForegroundColor Magenta
Write-Host "Download Complete!" -ForegroundColor Green
Write-Host "  Success: $successCount" -ForegroundColor Green
Write-Host "  Failed:  $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host "=" * 50 -ForegroundColor Magenta
