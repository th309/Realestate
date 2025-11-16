# Get database schema summary
# Usage: .\scripts\get-schema-summary.ps1

Write-Host "📊 SUPABASE DATABASE SCHEMA SUMMARY`n" -ForegroundColor Cyan

# Get all tables with row counts
Write-Host "=== TABLES AND ROW COUNTS ===" -ForegroundColor Yellow
.\scripts\psql.ps1 @"
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY tablename;
"@

Write-Host "`n=== TABLE DETAILS ===" -ForegroundColor Yellow

# Get detailed info for key tables
$keyTables = @("markets", "tiger_zcta", "tiger_counties", "tiger_cbsa", "tiger_places", "tiger_states", "geo_zip_county", "geo_zip_cbsa", "geo_zip_place", "markets_hierarchy", "geographic_units")

foreach ($table in $keyTables) {
    Write-Host "`n--- $table ---" -ForegroundColor Cyan
    .\scripts\psql.ps1 "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$table' ORDER BY ordinal_position;"
}

