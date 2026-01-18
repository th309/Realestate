/**
 * Run migration 048 to create census_* and economic_* tables
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config({ path: './packages/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function runMigration() {
  console.log('Running migration 048: Create census_* and economic_* tables...\n');

  // Read the migration file
  const migrationPath = join(__dirname, 'migrations/048-create-census-economic-tables.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf8');

  // Split into individual statements (remove BEGIN/COMMIT, comments, empty lines)
  const statements = migrationSQL
    .replace(/--.*$/gm, '')  // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove multi-line comments
    .split(';')
    .map(s => s.trim())
    .filter(s => s && s.length > 0)
    .filter(s => !s.match(/^(BEGIN|COMMIT|DO \$\$)$/i))
    .filter(s => !s.match(/DO \$\$/i));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    const preview = sql.substring(0, 70).replace(/\s+/g, ' ');

    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.log(`  Warning: ${error.message}`);
      errorCount++;
    } else {
      successCount++;
    }
  }

  console.log(`\nMigration complete: ${successCount} succeeded, ${errorCount} warnings`);

  // Verify tables were created
  console.log('\nVerifying tables...');

  const tables = [
    'census_national', 'census_state', 'census_metro', 'census_county', 'census_city', 'census_zip',
    'economic_national', 'economic_state', 'economic_metro', 'economic_county'
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`  ❌ ${table}: ${error.message}`);
    } else {
      console.log(`  ✓ ${table}`);
    }
  }
}

runMigration().catch(console.error);
