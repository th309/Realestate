# Monitor MSA FRED Verification Progress
# Usage: .\scripts\monitor-verification-progress.ps1

$logFile = "C:\Projects\Real Estate\msa-fred-verification.log"

if (-not (Test-Path $logFile)) {
    Write-Host "Log file not found: $logFile"
    exit 1
}

Write-Host "Monitoring verification progress... (Press Ctrl+C to stop)`n"

while ($true) {
    Clear-Host
    Write-Host "=== MSA FRED Verification Progress ===" -ForegroundColor Cyan
    Write-Host "Last updated: $(Get-Date -Format 'HH:mm:ss')`n" -ForegroundColor Gray
    
    $content = Get-Content $logFile -Tail 30
    $content | ForEach-Object {
        if ($_ -match '\[(\d+)/(\d+)\]') {
            $current = $matches[1]
            $total = $matches[2]
            $percent = [math]::Round(($current / $total) * 100, 1)
            Write-Host $_ -ForegroundColor $(if ($_ -match '✅') { 'Green' } elseif ($_ -match '⚠️') { 'Yellow' } elseif ($_ -match '❌') { 'Red' } else { 'White' })
        } elseif ($_ -match 'Progress:') {
            Write-Host $_ -ForegroundColor Cyan
        } else {
            Write-Host $_
        }
    }
    
    Start-Sleep -Seconds 5
}

