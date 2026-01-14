/**
 * Run Migration 038: Create realtor_national table
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
  console.log('=== Running Migration 038: Create realtor_national table ===\n');

  const sqlPath = join(__dirname, 'migrations', '038-create-realtor-national-table.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  // For this migration, we need to run it as a single transaction
  // Remove the BEGIN/COMMIT and run statements individually
  const cleanedSql = sql
    .replace(/BEGIN;/g, '')
    .replace(/COMMIT;/g, '')
    .replace(/DO \$\$[\s\S]*?\$\$;/g, ''); // Remove the DO block

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

  // Verify the table was created
  console.log('\n=== Verifying realtor_national table ===\n');

  const { data, error } = await supabase
    .from('realtor_national')
    .select('period_date, median_listing_price, active_listing_count')
    .limit(5);

  if (error) {
    console.log('Error querying realtor_national:', error.message);
  } else {
    console.log(`Records found: ${data?.length || 0}`);
    if (data && data.length > 0) {
      console.log('Sample records:');
      data.forEach(r => console.log(`  ${r.period_date}: $${Math.round(r.median_listing_price).toLocaleString()}, ${r.active_listing_count?.toLocaleString()} listings`));
    } else {
      console.log('Table created successfully (no records yet - ready for import)');
    }
  }
}

runMigration().catch(console.error);
