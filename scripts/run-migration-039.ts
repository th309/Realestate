/**
 * Run Migration 039: Create realtor_state table
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../packages/frontend/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runMigration() {
  console.log('=== Running Migration 039: Create realtor_state table ===\n');

  const sqlPath = join(__dirname, 'migrations', '039-create-realtor-state-table.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  // Remove BEGIN/COMMIT and DO blocks for execution
  const cleanedSql = sql
    .replace(/BEGIN;/g, '')
    .replace(/COMMIT;/g, '')
    .replace(/DO \$\$[\s\S]*?\$\$;/g, '');

  // Split into statements
  const statements = cleanedSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ').replace(/\s+/g, ' ');
    console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);

    const { error } = await supabase.rpc('exec_sql', { query: stmt });

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
    } else {
      console.log(`   ✅ Success`);
      success++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Migration complete: ${success} succeeded, ${failed} failed`);
  console.log('='.repeat(50));
}

runMigration().catch(console.error);
