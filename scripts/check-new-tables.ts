import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkTables() {
  const newTables = [
    'zillow_metro', 'zillow_county', 'zillow_zip', 'zillow_state',
    'census_data', 'fred_data',
    'geographies', 'metric_definitions', 'metric_percentiles',
    'calculated_metrics',
    'propertyiq_scores', 'propertyiq_score_details', 'propertyiq_score_history',
    'reports', 'report_conversations', 'user_report_memory',
    'news_cache', 'user_profiles', 'organizations', 'user_alerts',
    'data_ingestion_log', 'data_source_registry', 'score_calculation_log'
  ];

  const exists: string[] = [];
  const missing: string[] = [];

  console.log('Checking new schema tables...\n');

  for (const table of newTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      if (!error) {
        exists.push(table);
        console.log(`✓ ${table}`);
      } else if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
        missing.push(table);
        console.log(`✗ ${table} - not found`);
      } else if (error.message.includes('permission denied')) {
        exists.push(table);
        console.log(`✓ ${table} (exists, needs RLS policy)`);
      } else {
        console.log(`? ${table} - ${error.message}`);
      }
    } catch (e: any) {
      console.log(`? ${table} - ${e.message}`);
    }
  }

  console.log('\n--- SUMMARY ---');
  console.log(`Tables that exist: ${exists.length}`);
  console.log(`Tables missing: ${missing.length}`);

  if (missing.length > 0) {
    console.log('\nMissing tables:');
    missing.forEach(t => console.log(`  - ${t}`));
  }
}

checkTables().catch(console.error);
