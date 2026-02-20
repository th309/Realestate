import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Try different table names
  const tables = ['cbsa_metro_crosswalk', 'metro_crosswalk', 'zillow_metro_crosswalk', 'crosswalk'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      console.log(`Found table: ${table}`);
      console.log('Sample row:', JSON.stringify(data?.[0], null, 2));
      return;
    }
  }
  
  // Check how the existing import does it
  console.log('\nChecking zillow_metro for region mappings...');
  const { data } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, cbsa_code')
    .eq('metric_name', 'zori')
    .limit(5);
  
  console.log('Existing zillow_metro ZORI records:');
  data?.forEach(r => console.log(`  ${r.region_id}: ${r.region_name} -> ${r.cbsa_code}`));
}

check().catch(console.error);
