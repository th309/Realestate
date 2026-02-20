import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  // Total count in crosswalk
  const { count: totalRows } = await supabase
    .from('geography_crosswalk')
    .select('*', { count: 'exact', head: true });
  console.log('Total rows in geography_crosswalk:', totalRows);

  // Get ALL county_fips with proper pagination to count unique values
  let allFips: string[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('geography_crosswalk')
      .select('county_fips')
      .not('county_fips', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.log('Error:', error);
      break;
    }
    if (!data || data.length === 0) break;

    allFips = allFips.concat(data.map(r => r.county_fips));
    page++;
    console.log(`Fetched page ${page}, got ${data.length} rows, total: ${allFips.length}`);
    if (data.length < pageSize) break;
  }

  const uniqueFips = [...new Set(allFips)];
  console.log('\nTotal unique county_fips (paginated):', uniqueFips.length);
  console.log('Sample FIPS codes:', uniqueFips.slice(0, 30).sort());

  // Check CA specifically
  const caFips = uniqueFips.filter(f => f.startsWith('06'));
  console.log('\nCA county_fips count:', caFips.length);
  console.log('All CA FIPS:', caFips.sort());

  // Now check zillow_zhvi County data
  console.log('\n--- zillow_zhvi County data ---');
  const { data: zhviCounties } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'County')
    .limit(5000);

  const uniqueZhviCounties = [...new Set(zhviCounties?.map(r => r.region_id) || [])];
  console.log('Unique counties in zillow_zhvi:', uniqueZhviCounties.length);

  const zhviCaCounties = uniqueZhviCounties.filter(f => f.startsWith('06'));
  console.log('CA counties in zillow_zhvi:', zhviCaCounties.length);
  console.log('All CA zillow_zhvi:', zhviCaCounties.sort());

  // Intersection
  const inBoth = caFips.filter(f => zhviCaCounties.includes(f));
  console.log('\nCA counties in BOTH tables:', inBoth.length);

  const inCrosswalkOnly = caFips.filter(f => !zhviCaCounties.includes(f));
  console.log('In crosswalk but NOT in zillow_zhvi:', inCrosswalkOnly.length);
  if (inCrosswalkOnly.length > 0 && inCrosswalkOnly.length <= 20) {
    console.log(inCrosswalkOnly);
  }

  const inZhviOnly = zhviCaCounties.filter(f => !caFips.includes(f));
  console.log('In zillow_zhvi but NOT in crosswalk:', inZhviOnly.length);
  if (inZhviOnly.length > 0 && inZhviOnly.length <= 20) {
    console.log(inZhviOnly);
  }
}

check();
