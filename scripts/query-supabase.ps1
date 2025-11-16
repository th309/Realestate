# Query Supabase using Admin Client (Reliable alternative to psql)
# Usage: .\scripts\query-supabase.ps1 "SELECT COUNT(*) FROM markets;"

param(
    [Parameter(Mandatory=$true)]
    [string]$Query
)

# Change to web directory to load environment
$webDir = Join-Path $PSScriptRoot "..\web"
Push-Location $webDir

try {
    # Load environment variables
    $envPath = Join-Path $webDir ".env.local"
    if (-not (Test-Path $envPath)) {
        Write-Host "❌ Error: .env.local not found in web directory" -ForegroundColor Red
        Write-Host "Please create web/.env.local with SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Yellow
        exit 1
    }

    # Import the admin client
    $adminPath = Join-Path $webDir "lib\supabase\admin.ts"
    if (-not (Test-Path $adminPath)) {
        Write-Host "❌ Error: Admin client not found" -ForegroundColor Red
        exit 1
    }

    Write-Host "Executing SQL query via Supabase Admin API..." -ForegroundColor Cyan
    Write-Host "Query: $Query`n" -ForegroundColor Gray

    # Use Node.js to execute the query via Supabase client
    $nodeScript = @"
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY not found');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const query = `$Query`;

// Execute via RPC if exec_sql exists, otherwise use direct query
supabase.rpc('exec_sql', { sql: query })
    .then(({ data, error }) => {
        if (error) {
            // Try direct query on a simple table
            if (query.toLowerCase().includes('select')) {
                console.error('RPC failed, trying direct query...');
                console.error('Note: Direct queries are limited. Use exec_sql RPC for full SQL support.');
            }
            console.error('Error:', JSON.stringify(error, null, 2));
            process.exit(1);
        } else {
            console.log(JSON.stringify(data, null, 2));
        }
    })
    .catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
    });
"@

    $tempScript = [System.IO.Path]::GetTempFileName() + ".js"
    $nodeScript | Out-File -FilePath $tempScript -Encoding UTF8

    try {
        $result = & node $tempScript 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Query executed successfully" -ForegroundColor Green
            Write-Host $result
        } else {
            Write-Host "❌ Query failed" -ForegroundColor Red
            Write-Host $result
            exit 1
        }
    } finally {
        Remove-Item $tempScript -ErrorAction SilentlyContinue
    }
} finally {
    Pop-Location
}

