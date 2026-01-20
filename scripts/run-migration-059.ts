/**
 * Run migration 059 to backfill YoY in permits tables
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
  console.log('Running migration 059: Backfill YoY in permits tables...\n');

  // Check current state before migration
  console.log('Checking current state...');

  const { count: countyNullCount } = await supabase
    .from('permits_county')
    .select('*', { count: 'exact', head: true })
    .is('total_units_yoy', null);

  const { count: stateNullCount } = await supabase
    .from('permits_state')
    .select('*', { count: 'exact', head: true })
    .is('total_units_yoy', null);

  console.log(`  permits_county: ${countyNullCount ?? 0} rows with null YoY`);
  console.log(`  permits_state: ${stateNullCount ?? 0} rows with null YoY`);

  // Read the migration file
  const migrationPath = join(__dirname, 'migrations/059-backfill-permits-yoy.sql');
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

    // Use CTE pattern to execute UPDATE via exec_sql
    const wrappedSql = `WITH updated AS (${sql} RETURNING 1) SELECT COUNT(*) as count FROM updated`;
    const { data, error } = await supabase.rpc('exec_sql', { sql: wrappedSql });

    if (error) {
      console.log(`  Error: ${error.message}`);
      errorCount++;
    } else {
      const count = data?.[0]?.count ?? 0;
      console.log(`  ✓ Updated ${count} rows`);
      successCount++;
    }
  }

  console.log(`\nMigration complete: ${successCount} succeeded, ${errorCount} errors`);

  // Verify results
  console.log('\nVerifying results...');

  const { count: countyNullAfter } = await supabase
    .from('permits_county')
    .select('*', { count: 'exact', head: true })
    .is('total_units_yoy', null);

  const { count: stateNullAfter } = await supabase
    .from('permits_state')
    .select('*', { count: 'exact', head: true })
    .is('total_units_yoy', null);

  console.log(`  permits_county: ${countyNullAfter ?? 0} rows with null YoY (was ${countyNullCount ?? 0})`);
  console.log(`  permits_state: ${stateNullAfter ?? 0} rows with null YoY (was ${stateNullCount ?? 0})`);

  // Check latest period specifically
  const { data: latestPeriod } = await supabase
    .from('permits_county')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1);

  if (latestPeriod && latestPeriod[0]) {
    const latest = latestPeriod[0].period_date;
    const { count: latestNullYoy } = await supabase
      .from('permits_county')
      .select('*', { count: 'exact', head: true })
      .eq('period_date', latest)
      .is('total_units_yoy', null);

    const { count: latestTotal } = await supabase
      .from('permits_county')
      .select('*', { count: 'exact', head: true })
      .eq('period_date', latest);

    console.log(`\nLatest period (${latest}):`);
    console.log(`  ${latestNullYoy ?? 0} null YoY out of ${latestTotal} counties`);
    console.log(`  ${(latestTotal ?? 0) - (latestNullYoy ?? 0)} counties have YoY data (${(((latestTotal ?? 0) - (latestNullYoy ?? 0)) / (latestTotal || 1) * 100).toFixed(1)}%)`);
  }
}

runMigration().catch(console.error);
