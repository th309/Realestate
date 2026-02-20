import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  // Total rows in crosswalk
  const { count: total } = await supabase
    .from('geography_crosswalk')
    .select('*', { count: 'exact', head: true });
  console.log('Total rows in crosswalk:', total);

  // Total unique county_fips
  const { data: allFips } = await supabase
    .from('geography_crosswalk')
    .select('county_fips')
    .not('county_fips', 'is', null);

  const uniqueFips = [...new Set(allFips?.map(r => r.county_fips))];
  console.log('Total unique county_fips:', uniqueFips.length);

  // CA specifically - how many rows?
  const { count: caRows } = await supabase
    .from('geography_crosswalk')
    .select('*', { count: 'exact', head: true })
    .eq('state_abbrev', 'CA');
  console.log('\nCA rows in crosswalk:', caRows);

  // CA unique FIPS - fetch ALL without limit
  const { data: caFipsAll } = await supabase
    .from('geography_crosswalk')
    .select('county_fips')
    .eq('state_abbrev', 'CA')
    .not('county_fips', 'is', null);

  const caUniqueFips = [...new Set(caFipsAll?.map(r => r.county_fips))];
  console.log('CA unique county_fips:', caUniqueFips.length);
  console.log('All CA FIPS:', caUniqueFips.sort());

  // Now check zillow_zhvi CA counties
  const { data: zhviCa } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'County')
    .like('region_id', '06%');

  const zhviCaUnique = [...new Set(zhviCa?.map(r => r.region_id))];
  console.log('\nzillow_zhvi CA counties:', zhviCaUnique.length);
  console.log('All:', zhviCaUnique.sort());

  // Missing from crosswalk
  const missingFromCrosswalk = zhviCaUnique.filter(f => !caUniqueFips.includes(f));
  console.log('\nIn zillow_zhvi but NOT in crosswalk:', missingFromCrosswalk.length);
  console.log(missingFromCrosswalk);

  // Missing from zillow_zhvi
  const missingFromZhvi = caUniqueFips.filter(f => !zhviCaUnique.includes(f));
  console.log('\nIn crosswalk but NOT in zillow_zhvi:', missingFromZhvi.length);
  console.log(missingFromZhvi);
}

check();
