/**
 * Run migration 057 to create building permits tables
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
  console.log('Running migration 057: Create building permits tables...\n');

  // Read the migration file
  const migrationPath = join(__dirname, 'migrations/057-create-building-permits-tables.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf8');

  // Split into individual statements (remove BEGIN/COMMIT, comments, empty lines)
  const statements = migrationSQL
    .replace(/--.*$/gm, '')  // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove multi-line comments
    .split(';')
    .map(s => s.trim())
    .filter(s => s && s.length > 0)
    .filter(s => !s.match(/^(BEGIN|COMMIT)$/i))
    .filter(s => !s.match(/^DO \$\$/i));

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

  const tables = ['permits_state', 'permits_metro', 'permits_county'];

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
