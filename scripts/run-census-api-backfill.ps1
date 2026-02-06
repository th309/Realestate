$ErrorActionPreference = 'Stop'
$years = 2019..2023
foreach ($y in $years) {
  Write-Host "`n=== Census API Import $y ==="
  npx tsx scripts/importers/census-api-importer.ts --year=$y --all
  if ($LASTEXITCODE -ne 0) { throw "Import failed for $y" }
}
