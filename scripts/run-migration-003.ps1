# Temporary script to run migration 003
$sqlFile = Join-Path $PSScriptRoot "migrations\003-add-geographic-normalization-columns.sql"
$sql = Get-Content $sqlFile -Raw

Write-Host "Executing migration: 003-add-geographic-normalization-columns.sql" -ForegroundColor Cyan
Write-Host "File: $sqlFile" -ForegroundColor Gray
Write-Host ""

& (Join-Path $PSScriptRoot "execute-sql.ps1") -Query $sql

