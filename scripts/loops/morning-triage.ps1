# PIQ morning-triage loop invoker (read-only).
# Spec: docs/superpowers/specs/2026-06-15-piq-morning-triage-loop-design.md
# Runs the piq-morning-triage skill headless and logs the run. Fails loudly if
# no triage file is produced (guards against silent scheduler no-op).

$ErrorActionPreference = 'Stop'

# scripts/loops/morning-triage.ps1 -> repo root is two levels up.
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

$today   = Get-Date -Format 'yyyy-MM-dd'
$logDir  = Join-Path $repoRoot 'scripts/loops/logs'
$logFile = Join-Path $logDir "morning-triage-$today.log"
$outFile = Join-Path $repoRoot "tasks/triage/triage-$today.md"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
"=== morning-triage run $(Get-Date -Format o) ===" | Out-File -FilePath $logFile -Append -Encoding utf8

try {
    claude -p "/piq-morning-triage" --permission-mode acceptEdits *>> $logFile
    $exitCode = $LASTEXITCODE
} catch {
    $exitCode = 1
    ($_ | Out-String) | Out-File -FilePath $logFile -Append -Encoding utf8
}

$produced = Test-Path $outFile
"result: exit=$exitCode produced=$produced out=$outFile" | Out-File -FilePath $logFile -Append -Encoding utf8

if (-not $produced) {
    Write-Error "Triage produced no file at $outFile (exit=$exitCode). See $logFile"
    exit 1
}
exit $exitCode
