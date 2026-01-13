/**
 * Run migration 024 to create zillow_zhvf table
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
  console.log('Running migration 024: Create zillow_zhvf table\n');

  // Read the SQL file
  const sqlPath = join(__dirname, 'migrations/024-create-zillow-zhvf-table.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  // Split into statements (rough split by semicolon, handling multi-line)
  const statements = sql
    .split(/;[\r\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });

    if (error) {
      // Try direct query for DDL statements
      const { error: directError } = await supabase.from('_exec_sql').select('*').limit(0);
      console.log(`  Note: RPC not available, DDL may need to be run in Supabase dashboard`);
    } else {
      console.log(`  OK`);
    }
  }

  // Verify table was created
  console.log('\nVerifying table creation...');
  const { data, error } = await supabase
    .from('zillow_zhvf')
    .select('id')
    .limit(1);

  if (error) {
    console.log('Table verification failed:', error.message);
    console.log('\nYou may need to run the migration manually in the Supabase SQL Editor.');
    console.log('File: scripts/migrations/024-create-zillow-zhvf-table.sql');
  } else {
    console.log('Table zillow_zhvf created successfully!');
  }
}

runMigration().catch(console.error);
