# Simple schema export - gets all table structures
# Usage: .\scripts\get-schema-simple.ps1

$outputFile = "scripts/DATABASE-SCHEMA.md"

Write-Host "📊 Getting complete database schema..." -ForegroundColor Cyan

# Get all tables with a simple query
$tablesQuery = @"
SELECT 
    t.table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count,
    (SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = t.table_name) as row_count
FROM information_schema.tables t
WHERE t.table_schema = 'public' 
AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;
"@

Write-Host "`nGetting table list..." -ForegroundColor Yellow
$tables = .\scripts\psql.ps1 $tablesQuery

$schema = @"
# Complete Supabase Database Schema

Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

## Table Summary

$tables

---

## Detailed Table Schemas

"@

# Get detailed schema for each table
Write-Host "`nGetting detailed schema for each table..." -ForegroundColor Yellow

# Extract table names from the output
$tableLines = $tables -split "`n" | Where-Object { $_ -match "^\s+\|\s+(\w+)\s+\|" }
$tableNames = $tableLines | ForEach-Object {
    if ($_ -match "^\s+\|\s+(\w+)\s+\|") {
        $matches[1]
    }
} | Where-Object { $_ -and $_ -ne "table_name" -and $_ -ne "----" }

$total = $tableNames.Count
$current = 0

foreach ($table in $tableNames) {
    $current++
    Write-Host "[$current/$total] $table" -ForegroundColor Gray
    
    $schema += "`n### $table`n`n"
    
    # Get columns
    $columnsQuery = "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$table' ORDER BY ordinal_position;"
    $columns = .\scripts\psql.ps1 $columnsQuery
    
    $schema += "**Columns:**`n`n"
    $schema += "| Column | Type | Nullable | Default |`n"
    $schema += "|--------|------|----------|---------|`n"
    
    $columns -split "`n" | ForEach-Object {
        if ($_ -match "^\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|") {
            $col = $matches[1].Trim()
            $type = $matches[2].Trim()
            $nullable = $matches[3].Trim()
            $default = $matches[4].Trim()
            
            if ($col -ne "column_name" -and $col -ne "----" -and $col) {
                $default = if ($default -eq "") { "NULL" } else { $default }
                $schema += "| $col | $type | $nullable | $default |`n"
            }
        }
    }
    
    $schema += "`n"
}

# Save
$schema | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "`n✅ Schema saved to: $outputFile" -ForegroundColor Green
Write-Host "`nShowing file location..." -ForegroundColor Cyan
Write-Host "File: $((Resolve-Path $outputFile).Path)" -ForegroundColor White

