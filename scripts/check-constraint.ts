import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkData() {
  // Check for any FIPS-formatted county records (5 digits starting with 0)
  const { data: fipsRecords, count: fipsCount } = await supabase
    .from('zillow_zhvi')
    .select('region_id, date', { count: 'exact' })
    .eq('geography', 'County')
    .like('region_id', '0%')
    .limit(10);

  console.log('FIPS-formatted county records:', fipsCount);
  console.log('Sample:', fipsRecords);

  // Check for old Zillow-formatted county records
  const { count: oldCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County')
    .not('region_id', 'like', '0%');

  console.log('\nOld Zillow format county records:', oldCount);
}

checkData();
