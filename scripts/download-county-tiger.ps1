# ============================================================================
# Download Census TIGER County Shapefiles
# Downloads the most recent available county-level TIGER data
# ============================================================================

$OutputDir = ".\shapefiles"
$Years = @("2024", "2023", "2022")  # Try most recent first

Write-Host "========================================" -ForegroundColor Green
Write-Host "Census TIGER County Shapefile Downloader" -ForegroundColor Green  
Write-Host "========================================" -ForegroundColor Green

# Create output directory
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Host "Created directory: $OutputDir" -ForegroundColor Yellow
}

Set-Location $OutputDir

$downloaded = $false

foreach ($Year in $Years) {
    $BaseUrl = "https://www2.census.gov/geo/tiger/TIGER$Year"
    $countyFile = "tl_${Year}_us_county.zip"
    $url = "$BaseUrl/COUNTY/$countyFile"
    
    Write-Host "`nChecking for $Year county file..." -ForegroundColor Cyan
    
    # Check if file exists
    try {
        $response = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -ErrorAction Stop
        $contentLength = $response.Headers.'Content-Length'
        if ($contentLength) {
            $length = if ($contentLength -is [Array]) { [long]$contentLength[0] } else { [long]$contentLength }
            $sizeMB = [math]::Round($length / 1MB, 2)
            Write-Host "  ✓ Found: $countyFile ($sizeMB MB)" -ForegroundColor Green
        } else {
            Write-Host "  ✓ Found: $countyFile" -ForegroundColor Green
        }
        
        # Check if already downloaded
        if (Test-Path $countyFile) {
            Write-Host "  ✓ File already exists locally" -ForegroundColor Yellow
            
            # Check if extracted
            $shpFile = $countyFile -replace '\.zip$', '.shp'
            if (Test-Path $shpFile) {
                Write-Host "  ✓ Already extracted" -ForegroundColor Green
                $downloaded = $true
                break
            }
        }
        
        # Download
        Write-Host "  Downloading..." -ForegroundColor Gray
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $url -OutFile $countyFile -UseBasicParsing -ErrorAction Stop
        $ProgressPreference = 'Continue'
        
        $localSizeMB = [math]::Round((Get-Item $countyFile).Length / 1MB, 2)
        Write-Host "  ✓ Downloaded ($localSizeMB MB)" -ForegroundColor Green
        
        # Extract
        Write-Host "  Extracting..." -ForegroundColor Gray
        Expand-Archive -Path $countyFile -DestinationPath "." -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ Extracted successfully" -ForegroundColor Green
        
        $downloaded = $true
        break
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Host "  ✗ Not found for $Year" -ForegroundColor Yellow
            continue
        }
        else {
            Write-Host "  ✗ Error: $_" -ForegroundColor Red
            continue
        }
    }
}

if (!$downloaded) {
    Write-Host "`n❌ Failed to download county files for any available year" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✓ County TIGER data download complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# List downloaded files
Write-Host "`nDownloaded files:" -ForegroundColor Cyan
Get-ChildItem -Filter "tl_*_us_county.*" | Select-Object Name, @{Name="Size (MB)";Expression={[math]::Round($_.Length / 1MB, 2)}} | Format-Table -AutoSize

