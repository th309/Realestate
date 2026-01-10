# Fast PowerShell download script for Redfin files
# Uses native PowerShell downloads which are often faster than Node.js

$outputDir = "C:\Projects\Real Estate\redfin_downloads\raw_files"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$files = @(
    @{
        Name = "City Market Tracker"
        Url = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/city_market_tracker.tsv000.gz"
        Output = "$outputDir\housing_market_city.tsv"
        TempGz = "$outputDir\housing_market_city.tmp.gz"
    },
    @{
        Name = "Zip Code Market Tracker"
        Url = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz"
        Output = "$outputDir\housing_market_zip.tsv"
        TempGz = "$outputDir\housing_market_zip.tmp.gz"
    }
)

foreach ($file in $files) {
    Write-Host "`n📥 Downloading: $($file.Name)" -ForegroundColor Cyan
    Write-Host "   URL: $($file.Url)"
    
    try {
        # Download compressed file
        Write-Host "   Downloading compressed file..." -ForegroundColor Yellow
        $startTime = Get-Date
        
        Invoke-WebRequest -Uri $file.Url -OutFile $file.TempGz -UseBasicParsing
        
        $downloadTime = (Get-Date) - $startTime
        $sizeMB = [math]::Round((Get-Item $file.TempGz).Length / 1MB, 2)
        Write-Host "   ✅ Downloaded $sizeMB MB in $($downloadTime.TotalSeconds.ToString('F1')) seconds" -ForegroundColor Green
        
        # Decompress using .NET GZipStream
        Write-Host "   🔓 Decompressing..." -ForegroundColor Yellow
        $decompressStart = Get-Date
        
        $inputFile = New-Object System.IO.FileStream($file.TempGz, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read)
        $gzipStream = New-Object System.IO.Compression.GZipStream($inputFile, [System.IO.Compression.CompressionMode]::Decompress)
        $outputFile = New-Object System.IO.FileStream($file.Output, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
        
        $buffer = New-Object byte[](1024 * 1024) # 1MB buffer
        $totalBytes = 0
        
        while ($true) {
            $bytesRead = $gzipStream.Read($buffer, 0, $buffer.Length)
            if ($bytesRead -eq 0) { break }
            $outputFile.Write($buffer, 0, $bytesRead)
            $totalBytes += $bytesRead
            
            # Progress every 100MB
            if ($totalBytes % (100 * 1024 * 1024) -eq 0) {
                $mb = [math]::Round($totalBytes / 1MB, 2)
                Write-Host "   Decompressing: $mb MB..." -NoNewline
                Write-Host "`r" -NoNewline
            }
        }
        
        $gzipStream.Close()
        $inputFile.Close()
        $outputFile.Close()
        
        $decompressTime = (Get-Date) - $decompressStart
        $finalSizeMB = [math]::Round((Get-Item $file.Output).Length / 1MB, 2)
        Write-Host "   ✅ Decompressed to $finalSizeMB MB in $($decompressTime.TotalSeconds.ToString('F1')) seconds" -ForegroundColor Green
        
        # Clean up temp file
        Remove-Item $file.TempGz -Force
        Write-Host "   💾 Saved to: $($file.Output)" -ForegroundColor Green
        
    } catch {
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        # Clean up on error
        if (Test-Path $file.TempGz) { Remove-Item $file.TempGz -Force -ErrorAction SilentlyContinue }
        if (Test-Path $file.Output) { Remove-Item $file.Output -Force -ErrorAction SilentlyContinue }
    }
}

Write-Host "`n✅ Download complete!" -ForegroundColor Green


