$patterns = @(
  'dev:fresh',
  'concurrently',
  'nest.js',
  'start:dev',
  'dist/main',
  'next/dist/bin/next',
  'next-dev',
  'next dev',
  'npm run dev -w web',
  'render-cli',
  'jest.*content-pipeline',
  'chrome-headless-shell'
)

$all = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"
$hits = New-Object System.Collections.ArrayList
foreach ($p in $all) {
  if (-not $p.CommandLine) { continue }
  foreach ($pat in $patterns) {
    if ($p.CommandLine -match $pat) {
      [void]$hits.Add($p)
      break
    }
  }
}

Write-Host ("Matched {0} node processes" -f $hits.Count)
$hits | ForEach-Object {
  $k = 'other'
  if     ($_.CommandLine -match 'dev:fresh')    { $k = 'dev:fresh' }
  elseif ($_.CommandLine -match 'concurrently') { $k = 'concurrently' }
  elseif ($_.CommandLine -match 'nest.js')      { $k = 'nest-watch' }
  elseif ($_.CommandLine -match 'start:dev')    { $k = 'start:dev' }
  elseif ($_.CommandLine -match 'dist/main')    { $k = 'backend-main' }
  elseif ($_.CommandLine -match 'next')         { $k = 'next-frontend' }
  elseif ($_.CommandLine -match 'render-cli')   { $k = 'remotion-cli' }
  elseif ($_.CommandLine -match 'jest')         { $k = 'jest' }
  "  {0,6}  {1}" -f $_.ProcessId, $k
}

Write-Host ''
Write-Host '=== killing ==='
foreach ($h in $hits) {
  try {
    Stop-Process -Id $h.ProcessId -Force -ErrorAction Stop
    Write-Host ("killed {0}" -f $h.ProcessId)
  } catch {
    Write-Host ("FAILED {0} : {1}" -f $h.ProcessId, $_.Exception.Message)
  }
}

Write-Host ''
Write-Host '=== chrome-headless-shell ==='
Get-Process -Name 'chrome-headless-shell' -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    Stop-Process -Id $_.Id -Force -ErrorAction Stop
    Write-Host ("killed chrome-headless {0}" -f $_.Id)
  } catch {
    Write-Host ("FAILED chrome {0}" -f $_.Id)
  }
}

Write-Host ''
Write-Host '=== port check ==='
$line3000 = netstat -ano | Select-String ':3000.*LISTENING' | Select-Object -First 1
$line3001 = netstat -ano | Select-String ':3001.*LISTENING' | Select-Object -First 1
Write-Host ("3000: " + $(if ($line3000) { $line3000.Line.Trim() } else { 'FREE' }))
Write-Host ("3001: " + $(if ($line3001) { $line3001.Line.Trim() } else { 'FREE' }))
