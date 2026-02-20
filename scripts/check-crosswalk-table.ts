import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log('Checking geography_crosswalk table...\n');

  // Check if table exists and get count
  const { count, error } = await supabase
    .from('geography_crosswalk')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log('Error:', error.message);
    return;
  }
  console.log('Total rows:', count);

  // Get sample row to see columns
  const { data: sample } = await supabase
    .from('geography_crosswalk')
    .select('*')
    .limit(1);

  if (sample?.[0]) {
    console.log('\nColumns:', Object.keys(sample[0]).join(', '));
    console.log('\nSample row:', JSON.stringify(sample[0], null, 2));
  }

  // Check Zillow mappings
  const { data: withCounty, count: countyCount } = await supabase
    .from('geography_crosswalk')
    .select('*', { count: 'exact' })
    .not('zillow_county_region_id', 'is', null)
    .limit(3);

  console.log('\nRows with zillow_county_region_id:', countyCount);
  if (withCounty?.length) {
    console.log('Sample:', withCounty[0]);
  }
}

check();
