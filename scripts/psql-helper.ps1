# PSQL Helper Functions for Supabase
# Source this file: . .\scripts\psql-helper.ps1
# Then use: supabase-query "SELECT * FROM markets LIMIT 5;"

# Use session pooler (works reliably)
$script:SUPABASE_HOST = "aws-1-us-east-1.pooler.supabase.com"
$script:SUPABASE_PORT = 5432
$script:SUPABASE_DB = "postgres"
$script:SUPABASE_USER = "postgres.pysflbhpnqwoczyuaaif"
$script:SUPABASE_PASSWORD = ""

function Get-SupabasePassword {
    if ([string]::IsNullOrEmpty($script:SUPABASE_PASSWORD)) {
        # Try environment variable
        $script:SUPABASE_PASSWORD = $env:SUPABASE_DB_PASSWORD
        
        # Try .env.local
        if ([string]::IsNullOrEmpty($script:SUPABASE_PASSWORD)) {
            $envPath = Join-Path $PSScriptRoot "..\web\.env.local"
            if (Test-Path $envPath) {
                $envContent = Get-Content $envPath -Raw
                if ($envContent -match 'SUPABASE_DB_PASSWORD=(.+)') {
                    $script:SUPABASE_PASSWORD = $matches[1].Trim()
                } elseif ($envContent -match 'DATABASE_URL=postgresql://[^:]+:([^@]+)@') {
                    $script:SUPABASE_PASSWORD = $matches[1].Trim()
                }
            }
        }
        
        # Prompt if still empty
        if ([string]::IsNullOrEmpty($script:SUPABASE_PASSWORD)) {
            $securePassword = Read-Host "Enter Supabase database password" -AsSecureString
            $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
            $script:SUPABASE_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        }
    }
    return $script:SUPABASE_PASSWORD
}

function supabase-query {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Query
    )
    
    $password = "Ihatedoingpt$$12"
    $env:PGPASSWORD = $password
    
    Write-Host "Executing query..." -ForegroundColor Cyan
    Write-Host "Query: $Query`n" -ForegroundColor Gray
    
    $result = & psql -h $script:SUPABASE_HOST -p $script:SUPABASE_PORT -U $script:SUPABASE_USER -d $script:SUPABASE_DB -c $Query 2>&1
    $exitCode = $LASTEXITCODE
    
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    
    if ($exitCode -eq 0) {
        return $result
    } else {
        Write-Error "Query failed: $result"
        return $null
    }
}

function supabase-connect {
    $password = "Ihatedoingpt$$12"
    $env:PGPASSWORD = $password
    
    Write-Host "Connecting to Supabase..." -ForegroundColor Cyan
    & psql -h $script:SUPABASE_HOST -p $script:SUPABASE_PORT -U $script:SUPABASE_USER -d $script:SUPABASE_DB
    
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

function supabase-schema {
    param(
        [string]$Table = ""
    )
    
    if ([string]::IsNullOrEmpty($Table)) {
        $query = @"
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
"@
    } else {
        $query = @"
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '$Table'
ORDER BY ordinal_position;
"@
    }
    
    supabase-query $query
}

function supabase-tables {
    $query = @"
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
"@
    supabase-query $query
}

# Export functions
Export-ModuleMember -Function supabase-query, supabase-connect, supabase-schema, supabase-tables

Write-Host "✅ Supabase PSQL helper functions loaded!" -ForegroundColor Green
Write-Host "   Use: supabase-query 'SELECT * FROM markets LIMIT 5;'" -ForegroundColor Gray
Write-Host "   Use: supabase-connect (for interactive session)" -ForegroundColor Gray
Write-Host "   Use: supabase-schema [table_name] (to see table structure)" -ForegroundColor Gray
Write-Host "   Use: supabase-tables (to list all tables)" -ForegroundColor Gray

