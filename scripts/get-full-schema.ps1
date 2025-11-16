# Get complete database schema
# Usage: .\scripts\get-full-schema.ps1

$outputFile = "scripts/DATABASE-SCHEMA-COMPLETE.md"

Write-Host "📊 Generating complete database schema..." -ForegroundColor Cyan
Write-Host ""

$schema = @"
# Complete Supabase Database Schema

Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

## Overview

This document contains the complete schema for all tables in the Supabase database.

"@

# Get table counts
Write-Host "Getting table statistics..." -ForegroundColor Yellow
$stats = .\scripts\psql.ps1 "SELECT relname as table_name, n_live_tup as row_count FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname;"

$schema += "## Table Statistics`n`n"
$schema += "| Table Name | Row Count |`n"
$schema += "|------------|-----------|`n"

$statsLines = $stats -split "`n" | Where-Object { $_ -match "\|" -and $_ -notmatch "table_name" -and $_ -notmatch "----" }
foreach ($line in $statsLines) {
    $parts = $line -split "\|" | ForEach-Object { $_.Trim() }
    if ($parts.Count -ge 2) {
        $schema += "| $($parts[0]) | $($parts[1]) |`n"
    }
}

$schema += "`n---`n`n"

# Get all tables
Write-Host "Getting all tables..." -ForegroundColor Yellow
$tablesResult = .\scripts\psql.ps1 "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

# Extract table names
$tableNames = @()
$tablesResult -split "`n" | ForEach-Object {
    if ($_ -match "^\s+\|\s+(\w+)\s+\|") {
        $tableName = $matches[1]
        if ($tableName -and $tableName -ne "table_name" -and $tableName -ne "----") {
            $tableNames += $tableName
        }
    }
}

Write-Host "Found $($tableNames.Count) tables. Generating schema for each..." -ForegroundColor Green
Write-Host ""

$count = 0
foreach ($table in $tableNames) {
    $count++
    Write-Progress -Activity "Generating Schema" -Status "Processing $table" -PercentComplete (($count / $tableNames.Count) * 100)
    
    $schema += "## Table: \`$table\`"`n`n"
    
    # Get columns
    $columns = .\scripts\psql.ps1 "SELECT column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$table' ORDER BY ordinal_position;"
    
    $schema += "### Columns`n`n"
    $schema += "| Column | Type | Nullable | Default |`n"
    $schema += "|--------|------|----------|---------|`n"
    
    $columns -split "`n" | ForEach-Object {
        if ($_ -match "^\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|") {
            $col = $matches[1].Trim()
            $type = $matches[2].Trim()
            $maxLen = $matches[3].Trim()
            $nullable = $matches[4].Trim()
            $default = $matches[5].Trim()
            
            if ($col -ne "column_name" -and $col -ne "----") {
                $typeDisplay = if ($maxLen -and $maxLen -ne "") { "$type($maxLen)" } else { $type }
                $schema += "| $col | $typeDisplay | $nullable | $default |`n"
            }
        }
    }
    
    $schema += "`n"
    
    # Get primary key
    $pk = .\scripts\psql.ps1 "SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) as pk_columns FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_schema = 'public' AND tc.table_name = '$table' AND tc.constraint_type = 'PRIMARY KEY';"
    if ($pk -match "pk_columns" -and $pk -notmatch "\(null\)" -and $pk -notmatch "\(0 rows\)") {
        $pkLine = $pk -split "`n" | Where-Object { $_ -match "\|" -and $_ -notmatch "pk_columns" -and $_ -notmatch "----" } | Select-Object -First 1
        if ($pkLine) {
            $pkParts = $pkLine -split "\|" | ForEach-Object { $_.Trim() }
            if ($pkParts.Count -ge 2 -and $pkParts[1]) {
                $schema += "**Primary Key:** $($pkParts[1])`n`n"
            }
        }
    }
    
    # Get foreign keys
    $fks = .\scripts\psql.ps1 "SELECT kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = '$table';"
    if ($fks -match "column_name" -and $fks -notmatch "\(0 rows\)") {
        $schema += "### Foreign Keys`n`n"
        $fks -split "`n" | ForEach-Object {
            if ($_ -match "^\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\|") {
                $col = $matches[1].Trim()
                $ftable = $matches[2].Trim()
                $fcol = $matches[3].Trim()
                if ($col -ne "column_name" -and $col -ne "----") {
                    $schema += "- \`$col\` → \`$ftable.$fcol\``n"
                }
            }
        }
        $schema += "`n"
    }
    
    $schema += "---`n`n"
}

Write-Progress -Activity "Generating Schema" -Completed

# Save to file
$schema | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "`n✅ Complete schema saved to: $outputFile" -ForegroundColor Green
Write-Host "`nQuick summary:" -ForegroundColor Cyan
.\scripts\psql.ps1 "SELECT relname as table_name, n_live_tup as row_count FROM pg_stat_user_tables WHERE schemaname = 'public' AND n_live_tup > 0 ORDER BY n_live_tup DESC LIMIT 10;"

