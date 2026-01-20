/**
 * Run migration 058 to backfill null total_units in permits tables
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or service key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running migration 058: Backfill null total_units in permits tables...\n');

  // Check current state before migration
  console.log('Checking current state...');

  const { count: countyNullCount } = await supabase
    .from('permits_county')
    .select('*', { count: 'exact', head: true })
    .is('total_units', null);

  const { count: stateNullCount } = await supabase
    .from('permits_state')
    .select('*', { count: 'exact', head: true })
    .is('total_units', null);

  console.log(`  permits_county: ${countyNullCount ?? 0} rows with null total_units`);
  console.log(`  permits_state: ${stateNullCount ?? 0} rows with null total_units`);

  // Read the migration file
  const migrationPath = join(__dirname, 'migrations/058-backfill-permits-total-units.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf8');

  // Split into individual statements
  const statements = migrationSQL
    .replace(/--.*$/gm, '')  // Remove single-line comments
    .split(';')
    .map(s => s.trim())
    .filter(s => s && s.length > 0);

  let successCount = 0;
  let errorCount = 0;

  console.log('\nRunning UPDATE statements...');

  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    const preview = sql.substring(0, 80).replace(/\s+/g, ' ');

    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.log(`  Error: ${error.message}`);
      errorCount++;
    } else {
      console.log(`  ✓ Success`);
      successCount++;
    }
  }

  console.log(`\nMigration complete: ${successCount} succeeded, ${errorCount} errors`);

  // Verify results
  console.log('\nVerifying results...');

  const { count: countyNullAfter } = await supabase
    .from('permits_county')
    .select('*', { count: 'exact', head: true })
    .is('total_units', null);

  const { count: stateNullAfter } = await supabase
    .from('permits_state')
    .select('*', { count: 'exact', head: true })
    .is('total_units', null);

  console.log(`  permits_county: ${countyNullAfter ?? 0} rows with null total_units (was ${countyNullCount ?? 0})`);
  console.log(`  permits_state: ${stateNullAfter ?? 0} rows with null total_units (was ${stateNullCount ?? 0})`);

  // Sample some data to verify
  console.log('\nSample verification (counties with total_units = 0):');
  const { data: sampleData } = await supabase
    .from('permits_county')
    .select('fips_code, county_name, sf_units, duplex_units, small_multi_units, large_multi_units, total_units')
    .eq('total_units', 0)
    .limit(5);

  if (sampleData && sampleData.length > 0) {
    sampleData.forEach(row => {
      console.log(`  ${row.fips_code} ${row.county_name}: sf=${row.sf_units}, duplex=${row.duplex_units}, small=${row.small_multi_units}, large=${row.large_multi_units} → total=${row.total_units}`);
    });
  } else {
    console.log('  No counties with total_units = 0');
  }
}

runMigration().catch(console.error);
