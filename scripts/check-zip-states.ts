import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })()
);

async function checkStates() {
  // Sample some records to see what state_code values look like
  const { data: sample } = await supabase
    .from('zillow_zip')
    .select('region_name, state_code')
    .limit(20);

  console.log('Sample records:');
  sample?.forEach(r => console.log(`  ZIP ${r.region_name} -> ${r.state_code || 'NULL'}`));

  // Get count of NULL state_codes
  const { count: nullCount } = await supabase
    .from('zillow_zip')
    .select('*', { count: 'exact', head: true })
    .is('state_code', null);

  console.log(`\nRecords with NULL state_code: ${nullCount}`);

  // Sample some records with null state_code
  const { data: nullSample } = await supabase
    .from('zillow_zip')
    .select('region_name')
    .is('state_code', null)
    .limit(10);

  console.log('\nSample ZIPs with NULL state_code:');
  nullSample?.forEach(r => console.log(`  ${r.region_name}`));
}

checkStates().catch(console.error);
