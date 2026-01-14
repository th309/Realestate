/**
 * Run Migrations 040-042: Create realtor_metro, realtor_county, realtor_zip tables
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

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

async function runMigrationFile(migrationNumber: string, fileName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running Migration ${migrationNumber}: ${fileName}`);
  console.log('='.repeat(60));

  const sqlPath = join(__dirname, 'migrations', fileName);
  const sql = readFileSync(sqlPath, 'utf8');

  const cleanedSql = sql
    .replace(/BEGIN;/g, '')
    .replace(/COMMIT;/g, '')
    .replace(/DO \$\$[\s\S]*?\$\$;/g, '');

  const statements = cleanedSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 70).replace(/\n/g, ' ').replace(/\s+/g, ' ');
    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    const { error } = await supabase.rpc('exec_sql', { query: stmt });

    if (error) {
      console.log(`   ❌ ${error.message}`);
      failed++;
    } else {
      console.log(`   ✅ Success`);
      success++;
    }
  }

  console.log(`\nMigration ${migrationNumber}: ${success} succeeded, ${failed} failed`);
  return failed === 0;
}

async function main() {
  console.log('🚀 Running Realtor.com Table Migrations');
  console.log('Creating: realtor_metro, realtor_county, realtor_zip');

  const migrations = [
    { num: '040', file: '040-create-realtor-metro-table.sql' },
    { num: '041', file: '041-create-realtor-county-table.sql' },
    { num: '042', file: '042-create-realtor-zip-table.sql' }
  ];

  let allSuccess = true;
  for (const m of migrations) {
    const success = await runMigrationFile(m.num, m.file);
    if (!success) allSuccess = false;
  }

  console.log('\n' + '='.repeat(60));
  if (allSuccess) {
    console.log('✅ ALL MIGRATIONS COMPLETED SUCCESSFULLY');
  } else {
    console.log('⚠️  SOME MIGRATIONS HAD ERRORS');
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
