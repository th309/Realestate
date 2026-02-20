import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log('Checking markets table for county FIPS...\n');

  // Check if any California county FIPS exist in markets
  const { data: calCounties, count: calCount } = await supabase
    .from('markets')
    .select('region_id', { count: 'exact' })
    .like('region_id', '06%')
    .limit(10);

  console.log('California counties in markets:', calCount);
  console.log('Sample:', calCounties?.map(d => d.region_id));

  // Check what's in markets table
  const { data: allMarkets, count: allCount } = await supabase
    .from('markets')
    .select('region_id', { count: 'exact' })
    .limit(20);

  console.log('\nTotal markets:', allCount);
  console.log('Sample market region_ids:', allMarkets?.map(d => d.region_id));
}

check();
