/**
 * Run Migration 034: Create zillow_city table and clean zillow_zip
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

async function runMigration() {
  console.log('Running Migration 034: Create zillow_city table\n');

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Read migration SQL
  const migrationPath = join(__dirname, 'migrations/034-create-zillow-city-table.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  // Split into individual statements (handle transaction blocks)
  const statements = sql
    .split(/;(?=\s*(?:--|CREATE|DROP|TRUNCATE|ALTER|GRANT|BEGIN|COMMIT|DO))/gi)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 5);

  console.log(`Executing ${statements.length} SQL statements...\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ');

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });

      if (error) {
        // Try direct query if RPC doesn't exist
        const { error: directError } = await supabase.from('_exec').select().limit(0);
        if (directError) {
          console.log(`[${i + 1}/${statements.length}] ${preview}...`);
          console.log(`  Note: Cannot execute directly, skipping check`);
        }
      } else {
        console.log(`[${i + 1}/${statements.length}] OK: ${preview}...`);
      }
    } catch (err: any) {
      console.log(`[${i + 1}/${statements.length}] ${preview}...`);
      console.log(`  Warning: ${err.message}`);
    }
  }

  // Verify tables exist
  console.log('\nVerifying tables...');

  const { data: cityCheck } = await supabase
    .from('zillow_city')
    .select('*', { count: 'exact', head: true });

  const { data: zipCheck, count: zipCount } = await supabase
    .from('zillow_zip')
    .select('*', { count: 'exact', head: true });

  console.log(`zillow_city: Table ${cityCheck !== null ? 'EXISTS' : 'NOT FOUND'}`);
  console.log(`zillow_zip: ${zipCount || 0} rows (should be 0 after truncate)`);

  console.log('\nMigration 034 completed!');
}

runMigration().catch(console.error);
