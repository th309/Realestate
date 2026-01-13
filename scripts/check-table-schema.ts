/**
 * Check which Zillow tables exist and their row counts
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpqnwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I'
);

async function check() {
  console.log('=== Table Schema Check ===\n');

  // Check OLD tables (wide format)
  const oldTables = ['zillow_zhvi', 'zillow_zori', 'zillow_zhvf', 'zillow_zordi'];
  console.log('OLD FORMAT TABLES (wide):');
  for (const table of oldTables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`  ${table}: ${error ? 'ERROR - ' + error.message : count + ' rows'}`);
  }

  // Check NEW tables (long format)
  const newTables = ['zillow_state', 'zillow_metro', 'zillow_county', 'zillow_zip'];
  console.log('\nNEW FORMAT TABLES (long):');
  for (const table of newTables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`  ${table}: ${error ? 'ERROR - ' + error.message : count + ' rows'}`);
  }

  // Sample from zillow_zhvi
  console.log('\nSample from zillow_zhvi (old format):');
  const { data: zhviSample } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date, geography, property_type')
    .limit(3);
  console.log(zhviSample);

  // Sample from zillow_state (if exists)
  console.log('\nSample from zillow_state (new format):');
  const { data: stateSample, error: stateErr } = await supabase
    .from('zillow_state')
    .select('region_id, region_name, metric_name, period_date, value')
    .limit(3);
  if (stateErr) {
    console.log('  Error:', stateErr.message);
  } else {
    console.log(stateSample);
  }
}

check().catch(console.error);
