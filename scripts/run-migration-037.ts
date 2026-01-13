/**
 * Run Migration 037: Create zillow_zip table
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fetch as undiciFetch, Agent } from 'undici';

const agent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
  connect: { timeout: 60_000 },
});

const customFetch = (url: string | URL | Request, init?: RequestInit) => {
  return undiciFetch(url as any, { ...init, dispatcher: agent } as any);
};

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: customFetch as unknown as typeof fetch },
  }
);

async function runMigration() {
  console.log('=== Running Migration 037: Create zillow_zip table ===\n');

  const sqlPath = join(__dirname, 'migrations', '037-create-zillow-zip-table.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  // Split into statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
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
  console.log('\n=== Verifying zillow_zip table ===\n');

  const { data, error } = await supabase
    .from('zillow_zip')
    .select('region_id, region_name, state_code, period_date, metric_name, value')
    .limit(5);

  if (error) {
    console.log('Error querying zillow_zip:', error.message);
  } else {
    console.log(`Records found: ${data?.length || 0}`);
    if (data && data.length > 0) {
      console.log('Sample records:');
      data.forEach(r => console.log(`  ZIP ${r.region_name} (${r.state_code}): $${Math.round(r.value).toLocaleString()}`));
    }
  }

  // Count total records
  const { count } = await supabase
    .from('zillow_zip')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal records in zillow_zip: ${count}`);
}

runMigration().catch(console.error);
