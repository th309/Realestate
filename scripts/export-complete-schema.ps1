# Export complete database schema to a readable format
# Usage: .\scripts\export-complete-schema.ps1

$outputFile = "scripts/COMPLETE-DATABASE-SCHEMA.md"

Write-Host "📊 Exporting complete database schema..." -ForegroundColor Cyan
Write-Host ""

$schema = @"
# Complete Supabase Database Schema

Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

## Table Summary

"@

# Get table list with row counts
Write-Host "Getting table list and row counts..." -ForegroundColor Yellow
$tablesInfo = .\scripts\psql.ps1 "SELECT relname as table_name, n_live_tup as row_count FROM pg_stat_user_tables ORDER BY relname;"

$schema += "`n$tablesInfo`n`n"

# Get all tables
$allTables = .\scripts\psql.ps1 "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

# Extract table names
$tableNames = $allTables | Select-String -Pattern "^\s+\|\s+(\w+)\s+\|" | ForEach-Object { 
    if ($_.Matches.Groups.Count -gt 1) { $_.Matches.Groups[1].Value }
} | Where-Object { $_ -and $_ -ne "table_name" -and $_ -ne "----" }

Write-Host "Found $($tableNames.Count) tables" -ForegroundColor Green
Write-Host ""

# For each table, get complete details
$tableNum = 0
foreach ($table in $tableNames) {
    $tableNum++
    Write-Host "[$tableNum/$($tableNames.Count)] Processing: $table" -ForegroundColor Gray
    
    $schema += "---`n`n"
    $schema += "## Table: \`$table\`"`n`n"
    
    # Get columns
    $columns = .\scripts\psql.ps1 "SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$table' ORDER BY ordinal_position;"
    
    $schema += "### Columns`n`n"
    $schema += "| Column Name | Data Type | Nullable | Default |`n"
    $schema += "|-------------|-----------|----------|---------|`n"
    
    # Parse columns output
    $columnLines = $columns -split "`n" | Where-Object { $_ -match "\|" -and $_ -notmatch "column_name" -and $_ -notmatch "----" }
    foreach ($line in $columnLines) {
        $parts = $line -split "\|" | ForEach-Object { $_.Trim() }
        if ($parts.Count -ge 4) {
            $colName = $parts[0]
            $dataType = $parts[1]
            $nullable = $parts[5]
            $default = if ($parts[6]) { $parts[6] } else { "" }
            $schema += "| $colName | $dataType | $nullable | $default |`n"
        }
    }
    $schema += "`n"
    
    # Get primary keys
    $pks = .\scripts\psql.ps1 "SELECT column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_schema = 'public' AND tc.table_name = '$table' AND tc.constraint_type = 'PRIMARY KEY' ORDER BY kcu.ordinal_position;"
    if ($pks -match "column_name" -and $pks -notmatch "\(0 rows\)") {
        $schema += "### Primary Key`n`n"
        $pkCols = $pks | Select-String -Pattern "^\s+\|\s+(\w+)\s+\|" | ForEach-Object { $_.Matches.Groups[1].Value }
        $schema += "- " + ($pkCols -join ", ") + "`n`n"
    }
    
    # Get foreign keys
    $fks = .\scripts\psql.ps1 "SELECT kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = '$table';"
    if ($fks -match "column_name" -and $fks -notmatch "\(0 rows\)") {
        $schema += "### Foreign Keys`n`n"
        $fkLines = $fks -split "`n" | Where-Object { $_ -match "\|" -and $_ -notmatch "column_name" -and $_ -notmatch "----" }
        foreach ($line in $fkLines) {
            $parts = $line -split "\|" | ForEach-Object { $_.Trim() }
            if ($parts.Count -ge 3) {
                $schema += "- \`$($parts[0])\` → \`$($parts[1]).$($parts[2])\``n"
            }
        }
        $schema += "`n"
    }
    
    # Get indexes
    $indexes = .\scripts\psql.ps1 "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = '$table' ORDER BY indexname;"
    if ($indexes -match "indexname" -and $indexes -notmatch "\(0 rows\)") {
        $schema += "### Indexes`n`n"
        $idxLines = $indexes -split "`n" | Where-Object { $_ -match "\|" -and $_ -notmatch "indexname" -and $_ -notmatch "----" }
        foreach ($line in $idxLines) {
            $parts = $line -split "\|" | ForEach-Object { $_.Trim() }
            if ($parts.Count -ge 2) {
                $schema += "- **$($parts[0])**: \`$($parts[1])\``n"
            }
        }
        $schema += "`n"
    }
    
    $schema += "`n"
}

# Save to file
$schema | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "`n✅ Complete schema exported to: $outputFile" -ForegroundColor Green
Write-Host "`nDisplaying table summary..." -ForegroundColor Cyan

# Show summary
.\scripts\psql.ps1 "SELECT relname as table_name, n_live_tup as row_count FROM pg_stat_user_tables ORDER BY relname;"

