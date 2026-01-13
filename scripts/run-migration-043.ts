/**
 * Run Migration 043: Add calculated metric columns
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function main() {
  console.log('🚀 Running Migration 043: Add calculated metric columns');
  console.log('='.repeat(60));

  const sqlPath = join(__dirname, 'migrations', '043-add-calculated-metric-columns.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  // Remove transaction commands and anonymous blocks
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

  console.log('\n' + '='.repeat(60));
  console.log(`Migration 043: ${success} succeeded, ${failed} failed`);

  if (failed === 0) {
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
  } else {
    console.log('⚠️  SOME STATEMENTS FAILED');
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
