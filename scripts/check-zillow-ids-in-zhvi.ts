import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log('=== Checking if county data exists under Zillow IDs ===\n');

  // Get unique Zillow county IDs from crosswalk
  console.log('Getting unique zillow_county_region_id from crosswalk...');
  let allZillowIds: string[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('geography_crosswalk')
      .select('zillow_county_region_id')
      .not('zillow_county_region_id', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!data || data.length === 0) break;
    allZillowIds = allZillowIds.concat(data.map(r => String(r.zillow_county_region_id)));
    page++;
    if (data.length < pageSize) break;
  }

  const uniqueZillowIds = [...new Set(allZillowIds)];
  console.log('Unique Zillow county IDs in crosswalk:', uniqueZillowIds.length);

  // Check how many of these exist in zillow_zhvi
  console.log('\nChecking zillow_zhvi for these Zillow IDs...');

  // Sample check - first 20 Zillow IDs
  const sampleIds = uniqueZillowIds.slice(0, 20);
  console.log('\nSample Zillow IDs:', sampleIds);

  let foundInZhvi = 0;
  let notFoundInZhvi = 0;

  for (const zillowId of sampleIds) {
    const { count } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', 'County')
      .eq('region_id', zillowId);

    if (count && count > 0) {
      foundInZhvi++;
      console.log(`  ${zillowId}: ${count} records`);
    } else {
      notFoundInZhvi++;
    }
  }

  console.log(`\nSample results: ${foundInZhvi} found, ${notFoundInZhvi} not found`);

  // Now check all CA Zillow IDs
  console.log('\n=== CA County Zillow IDs check ===');
  const { data: caZillowIds } = await supabase
    .from('geography_crosswalk')
    .select('county_fips, county_name, zillow_county_region_id')
    .eq('state_abbrev', 'CA')
    .not('zillow_county_region_id', 'is', null)
    .limit(100);

  // Deduplicate by county
  const caCountyMap = new Map<string, any>();
  caZillowIds?.forEach(row => {
    if (!caCountyMap.has(row.county_fips)) {
      caCountyMap.set(row.county_fips, row);
    }
  });

  console.log('Unique CA counties in crosswalk:', caCountyMap.size);

  let caFoundByFips = 0;
  let caFoundByZillowId = 0;

  for (const [fips, row] of caCountyMap) {
    const zillowId = String(row.zillow_county_region_id);

    const { count: fipsCount } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', 'County')
      .eq('region_id', fips);

    const { count: zillowCount } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', 'County')
      .eq('region_id', zillowId);

    const hasFips = (fipsCount || 0) > 0;
    const hasZillow = (zillowCount || 0) > 0;

    if (hasFips) caFoundByFips++;
    if (hasZillow) caFoundByZillowId++;

    if (hasFips || hasZillow) {
      console.log(`${fips} ${row.county_name}: FIPS=${fipsCount || 0}, ZillowID(${zillowId})=${zillowCount || 0}`);
    }
  }

  console.log(`\nCA counties found by FIPS: ${caFoundByFips}`);
  console.log(`CA counties found by Zillow ID: ${caFoundByZillowId}`);
}

check().catch(console.error);
