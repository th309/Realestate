# Get complete database schema from Supabase
# Usage: .\scripts\get-complete-schema.ps1

$outputFile = "scripts/complete-schema-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"

Write-Host "🔍 Retrieving complete database schema..." -ForegroundColor Cyan
Write-Host ""

# Get all tables
Write-Host "Getting tables..." -ForegroundColor Yellow
$tables = .\scripts\psql.ps1 "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

# Get complete schema for each table
$schema = @"
========================================
COMPLETE SUPABASE DATABASE SCHEMA
Generated: $(Get-Date)
========================================

"@

# Tables overview
$schema += "`n=== TABLES ===`n`n"
$schema += $tables
$schema += "`n`n"

# For each table, get detailed schema
$tableList = $tables | Select-String -Pattern "^\s+\|\s+(\w+)\s+\|" | ForEach-Object { 
    if ($_.Matches.Groups.Count -gt 1) { $_.Matches.Groups[1].Value }
}

foreach ($table in $tableList) {
    if ([string]::IsNullOrWhiteSpace($table)) { continue }
    
    Write-Host "Getting schema for: $table" -ForegroundColor Gray
    
    $schema += "`n========================================`n"
    $schema += "TABLE: $table`n"
    $schema += "========================================`n`n"
    
    # Columns
    $columns = .\scripts\psql.ps1 "SELECT column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$table' ORDER BY ordinal_position;"
    $schema += "COLUMNS:`n"
    $schema += $columns
    $schema += "`n`n"
    
    # Primary keys
    $pks = .\scripts\psql.ps1 "SELECT column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_schema = 'public' AND tc.table_name = '$table' AND tc.constraint_type = 'PRIMARY KEY' ORDER BY kcu.ordinal_position;"
    if ($pks -match "column_name") {
        $schema += "PRIMARY KEYS:`n"
        $schema += $pks
        $schema += "`n`n"
    }
    
    # Foreign keys
    $fks = .\scripts\psql.ps1 "SELECT kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = '$table';"
    if ($fks -match "column_name") {
        $schema += "FOREIGN KEYS:`n"
        $schema += $fks
        $schema += "`n`n"
    }
    
    # Indexes
    $indexes = .\scripts\psql.ps1 "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = '$table' ORDER BY indexname;"
    if ($indexes -match "indexname") {
        $schema += "INDEXES:`n"
        $schema += $indexes
        $schema += "`n`n"
    }
    
    $schema += "`n"
}

# Save to file
$schema | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "`n✅ Complete schema saved to: $outputFile" -ForegroundColor Green
Write-Host "`nDisplaying summary..." -ForegroundColor Cyan

# Show summary
.\scripts\psql.ps1 "SELECT table_name, (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count FROM information_schema.tables t WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

