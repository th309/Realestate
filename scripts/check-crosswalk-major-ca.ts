import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log('=== Checking geography_crosswalk for major CA counties ===\n');

  const majorCaCounties = [
    { fips: '06037', name: 'Los Angeles' },
    { fips: '06073', name: 'San Diego' },
    { fips: '06059', name: 'Orange' },
    { fips: '06065', name: 'Riverside' },
    { fips: '06071', name: 'San Bernardino' },
    { fips: '06085', name: 'Santa Clara' },
    { fips: '06001', name: 'Alameda' },
    { fips: '06067', name: 'Sacramento' },
  ];

  console.log('--- geography_crosswalk ---');
  for (const county of majorCaCounties) {
    const { data, count } = await supabase
      .from('geography_crosswalk')
      .select('county_fips, county_name, zillow_county_region_id', { count: 'exact' })
      .eq('county_fips', county.fips)
      .limit(1);

    if (data && data.length > 0) {
      console.log(`${county.fips} ${county.name}: Found (Zillow ID: ${data[0].zillow_county_region_id}, rows: ${count})`);
    } else {
      console.log(`${county.fips} ${county.name}: NOT FOUND`);
    }
  }

  console.log('\n--- zillow_zhvi County data ---');
  for (const county of majorCaCounties) {
    // Check by FIPS code
    const { count: fipsCount } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', 'County')
      .eq('region_id', county.fips);

    // Get Zillow ID from crosswalk
    const { data: crosswalkData } = await supabase
      .from('geography_crosswalk')
      .select('zillow_county_region_id')
      .eq('county_fips', county.fips)
      .limit(1);

    const zillowId = crosswalkData?.[0]?.zillow_county_region_id;

    // Check by Zillow ID
    let zillowCount = 0;
    if (zillowId) {
      const { count } = await supabase
        .from('zillow_zhvi')
        .select('*', { count: 'exact', head: true })
        .eq('geography', 'County')
        .eq('region_id', String(zillowId));
      zillowCount = count || 0;
    }

    console.log(`${county.fips} ${county.name}:`);
    console.log(`  - By FIPS (${county.fips}): ${fipsCount || 0} records`);
    console.log(`  - By Zillow ID (${zillowId}): ${zillowCount} records`);
  }

  console.log('\n--- Total unique counties in zillow_zhvi by state prefix ---');
  // Sample check - count unique CA region_ids
  const { data: allCa } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'County')
    .like('region_id', '06%')
    .limit(1000);

  const uniqueCaInZhvi = [...new Set(allCa?.map(r => r.region_id) || [])];
  console.log('CA counties in zillow_zhvi:', uniqueCaInZhvi.length);
  console.log('FIPS codes:', uniqueCaInZhvi.sort());
}

check().catch(console.error);
