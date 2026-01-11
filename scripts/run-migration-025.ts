
/**
 * Run migration 025 to create zillow_zordi table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('Running migration 025: Create zillow_zordi table\n');

    // Read the SQL file
    const sqlPath = join(__dirname, 'migrations/025-create-zillow-zordi-table.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Split into statements
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
        console.log(`[${i + 1}/${statements.length}] ${preview}...`);

        // Use Postgres function exec_sql if available, or just log
        // We assume the RPC function exists based on previous scripts, but if not we can't run DDL via client.
        // However, the prior 024 script implies it might not work.
        // Let's try running it.
        const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });

        if (error) {
            console.log(`  Error: ${error.message}`);
        } else {
            console.log(`  OK`);
        }
    }

    // Verify table was created
    console.log('\nVerifying table creation...');
    const { data, error } = await supabase
        .from('zillow_zordi')
        .select('id')
        .limit(1);

    if (error) {
        if (error.code === 'PGRST204') { // Table not found
            console.log('Table zillow_zordi does NOT exist.');
            console.log('CRITICAL: You must run scripts/migrations/025-create-zillow-zordi-table.sql in Supabase SQL Editor.');
        } else {
            console.log('Verification check result:', error.message);
        }
    } else {
        console.log('Table zillow_zordi exists!');
    }
}

runMigration().catch(console.error);
