/**
 * Check which Zillow tables exist and their row counts
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpqnwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })()
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
