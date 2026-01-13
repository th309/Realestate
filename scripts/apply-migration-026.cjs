/**
 * Execute Migration 026 via Supabase REST API
 * 
 * Uses the Supabase postgREST exec_sql RPC or creates tables via API
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load env
dotenv.config({ path: path.join(__dirname, '..', 'packages', 'backend', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

console.log('Project URL:', supabaseUrl);

async function executeSql(sql) {
    // Try the management API endpoint for SQL execution
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

    // Method 1: Try via SQL API (requires additional setup)
    const sqlApiUrl = `${supabaseUrl}/rest/v1/rpc/exec_sql`;

    try {
        const response = await fetch(sqlApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ sql })
        });

        if (response.ok) {
            return { success: true, method: 'exec_sql' };
        }

        const error = await response.text();
        return { success: false, error, method: 'exec_sql' };
    } catch (e) {
        return { success: false, error: e.message, method: 'exec_sql' };
    }
}

async function runMigration() {
    console.log('='.repeat(60));
    console.log('Running Migration 026: Create Additional Zillow Market Tables');
    console.log('='.repeat(60));

    const migrationPath = path.join(__dirname, 'migrations', '026-create-additional-zillow-market-tables.sql');

    if (!fs.existsSync(migrationPath)) {
        console.error(`Migration file not found: ${migrationPath}`);
        process.exit(1);
    }

    const fullSql = fs.readFileSync(migrationPath, 'utf-8');

    // Try executing the full SQL
    console.log('Attempting to execute migration via REST API...');
    const result = await executeSql(fullSql);

    if (result.success) {
        console.log('✅ Migration executed successfully via', result.method);
    } else {
        console.log('❌ REST API method failed:', result.error?.substring(0, 100));
        console.log('');
        console.log('='.repeat(60));
        console.log('MANUAL MIGRATION REQUIRED');
        console.log('='.repeat(60));
        console.log('');
        console.log('Please run the following SQL in Supabase SQL Editor:');
        console.log('');
        console.log('1. Go to: https://supabase.com/dashboard');
        console.log('2. Open your project');
        console.log('3. Navigate to SQL Editor (left sidebar)');
        console.log('4. Click "New query"');
        console.log('5. Paste the following SQL and click "Run":');
        console.log('');
        console.log('='.repeat(60));
        console.log('');

        // Output the SQL in a copyable format
        console.log(fullSql);

        console.log('');
        console.log('='.repeat(60));
        console.log('');
        console.log('After running the SQL, verify with:');
        console.log('  node scripts/check-ingestion-status.cjs');
    }

    // Check if tables exist now
    console.log('');
    console.log('Checking for data_ingestion_log table...');

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase.from('data_ingestion_log').select('*').limit(1);

    if (error && error.code === 'PGRST116') {
        console.log('❌ Table does not exist yet - please run migration manually');
    } else if (error) {
        console.log('⚠️ Error checking table:', error.message);
    } else {
        console.log('✅ data_ingestion_log table exists!');
    }
}

runMigration()
    .then(() => {
        console.log('');
        console.log('Done.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
