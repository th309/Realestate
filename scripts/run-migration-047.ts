/**
 * Run migration 047 to grant calculated_metrics permissions to service_role
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function runMigration() {
  console.log('Running migration 047: Grant calculated_metrics permissions...\n');

  const statements = [
    // Grant full permissions on calculated_metrics to service_role
    `GRANT ALL ON calculated_metrics TO service_role`,

    // Grant to postgres role as well
    `GRANT ALL ON calculated_metrics TO postgres`,

    // Enable RLS
    `ALTER TABLE calculated_metrics ENABLE ROW LEVEL SECURITY`,

    // Drop and create service_role policy
    `DROP POLICY IF EXISTS "service_role_all" ON calculated_metrics`,
    `CREATE POLICY "service_role_all" ON calculated_metrics FOR ALL TO service_role USING (true) WITH CHECK (true)`,

    // Drop and create authenticated policy
    `DROP POLICY IF EXISTS "authenticated_read_write" ON calculated_metrics`,
    `CREATE POLICY "authenticated_read_write" ON calculated_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true)`,
  ];

  for (const sql of statements) {
    console.log(`Executing: ${sql.substring(0, 60)}...`);
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.log(`  Warning: ${error.message}`);
      // Try alternative approach for functions that don't exist
    } else {
      console.log('  Success');
    }
  }

  console.log('\nMigration complete. Testing write access...');

  // Test by doing a simple upsert
  const testResult = await supabase
    .from('calculated_metrics')
    .upsert({
      geography_id: 'TEST_MIGRATION',
      geography_type: 'test',
      period_date: '2025-12-01',
      inventory_surplus_pct: 999,
      calculated_at: new Date().toISOString(),
    }, { onConflict: 'geography_id,geography_type,period_date' });

  if (testResult.error) {
    console.log('Test write FAILED:', testResult.error.message);
  } else {
    console.log('Test write SUCCEEDED');

    // Clean up test record
    await supabase
      .from('calculated_metrics')
      .delete()
      .eq('geography_id', 'TEST_MIGRATION')
      .eq('geography_type', 'test');
    console.log('Test record cleaned up.');
  }
}

runMigration().catch(console.error);
