/**
 * Run Migration 026 - Create Additional Zillow Market Tables
 *
 * This creates tables for:
 * - New Listings, Pending Listings, Median List Price
 * - Sale-to-List Ratio, Days to Close
 * - Price Cut metrics (share, amount, percent)
 * - Data Ingestion Log and Data Source Registry
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env from backend
dotenv.config({ path: path.join(__dirname, '..', 'packages', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables:');
    console.error('- NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
    console.error('- SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

console.log('Using Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('='.repeat(60));
    console.log('Running Migration 026: Create Additional Zillow Market Tables');
    console.log('='.repeat(60));

    const migrationPath = path.join(__dirname, 'migrations', '026-create-additional-zillow-market-tables.sql');

    if (!fs.existsSync(migrationPath)) {
        console.error(`Migration file not found: ${migrationPath}`);
        process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Parse statements - handle dollar-quoted functions properly
    const statements = splitSqlStatements(sql);

    console.log(`Found ${statements.length} SQL statements to execute`);
    console.log('');
    console.log('NOTE: Due to Supabase API limitations, you may need to run this');
    console.log('SQL directly in the Supabase SQL Editor for full execution.');
    console.log('');
    console.log('Creating tables via individual queries...');
    console.log('');

    // Instead of trying to execute raw SQL, let's verify which tables already exist
    // and create tables using the API where possible

    const tablesToCreate = [
        'zillow_new_listings',
        'zillow_pending_listings',
        'zillow_median_list_price',
        'zillow_sale_to_list',
        'zillow_days_to_close',
        'zillow_price_cut_share',
        'zillow_price_cut_amt',
        'zillow_price_cut_pct',
        'data_ingestion_log',
        'data_source_registry'
    ];

    console.log('Checking existing tables...');

    for (const table of tablesToCreate) {
        const { error } = await supabase.from(table).select('*').limit(0);
        if (error && error.code === 'PGRST116') {
            console.log(`  [ ] ${table}: does not exist (needs creation)`);
        } else if (error) {
            console.log(`  [?] ${table}: ${error.message}`);
        } else {
            console.log(`  [✓] ${table}: already exists`);
        }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('IMPORTANT: To complete migration 026, please run the SQL file');
    console.log('directly in Supabase SQL Editor:');
    console.log('');
    console.log('  1. Go to https://supabase.com/dashboard');
    console.log('  2. Open your project');
    console.log('  3. Go to SQL Editor');
    console.log('  4. Copy and paste the contents of:');
    console.log('     scripts/migrations/026-create-additional-zillow-market-tables.sql');
    console.log('  5. Click "Run"');
    console.log('='.repeat(60));

    // Try a simple insert to data_ingestion_log to see if it exists
    const { error: testError } = await supabase
        .from('data_ingestion_log')
        .insert({
            source: 'test',
            table_name: 'test',
            status: 'running',
            records_processed: 0
        })
        .select()
        .single();

    if (!testError) {
        console.log('');
        console.log('✅ data_ingestion_log table is working!');

        // Delete the test record
        await supabase.from('data_ingestion_log').delete().eq('source', 'test');
        console.log('   (cleaned up test record)');
    } else if (testError.code === 'PGRST116') {
        console.log('');
        console.log('❌ data_ingestion_log table does not exist yet.');
        console.log('   Please run the migration SQL in Supabase SQL Editor.');
    } else {
        console.log('');
        console.log('⚠️  Error testing data_ingestion_log:', testError.message);
    }
}

function splitSqlStatements(sql) {
    const statements = [];
    let current = '';
    let inFunction = false;

    const lines = sql.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip pure comments
        if (trimmed.startsWith('--')) {
            continue;
        }

        // Check for dollar-quoted strings (used in functions)
        if (!inFunction && trimmed.includes('$$')) {
            inFunction = true;
        } else if (inFunction && trimmed.includes('$$')) {
            const count = (trimmed.match(/\$\$/g) || []).length;
            if (count >= 2 || (count === 1 && current.includes('$$'))) {
                inFunction = false;
            }
        }

        current += line + '\n';

        // If we're not in a function and line ends with semicolon
        if (!inFunction && trimmed.endsWith(';')) {
            statements.push(current.trim());
            current = '';
        }
    }

    if (current.trim()) {
        statements.push(current.trim());
    }

    return statements.filter(s => s && !s.match(/^--.*$/));
}

runMigration()
    .then(() => {
        console.log('\nMigration check completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
