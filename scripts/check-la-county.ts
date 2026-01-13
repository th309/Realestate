import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  // Check if LA County exists with any region_id format
  console.log('--- Searching for Los Angeles County (06037) ---');

  // Search by FIPS code
  const { data: fipsData } = await supabase
    .from('zillow_zhvi')
    .select('*')
    .eq('geography', 'County')
    .eq('region_id', '06037')
    .limit(5);

  console.log('By FIPS 06037:', fipsData?.length || 0, 'records');
  if (fipsData?.[0]) console.log('Sample:', fipsData[0]);

  // Search by partial match
  const { data: likeData } = await supabase
    .from('zillow_zhvi')
    .select('*')
    .eq('geography', 'County')
    .like('region_id', '%037%')
    .limit(10);

  console.log('\nBy region_id containing "037":', likeData?.length || 0, 'records');
  if (likeData) {
    likeData.forEach(r => console.log(`  ${r.region_id}: ${r.value}`));
  }

  // Check if LA exists as something other than County geography
  console.log('\n--- LA County in other geographies? ---');
  const { data: otherGeo } = await supabase
    .from('zillow_zhvi')
    .select('geography, region_id')
    .like('region_id', '06037%')
    .limit(10);

  if (otherGeo && otherGeo.length > 0) {
    console.log('Found in other geographies:');
    otherGeo.forEach(r => console.log(`  ${r.geography}: ${r.region_id}`));
  } else {
    console.log('No records with region_id starting with 06037');
  }

  // Check what property_type and tier combinations exist for County
  console.log('\n--- Property types and tiers for County ---');
  const { data: combos } = await supabase
    .from('zillow_zhvi')
    .select('property_type, tier')
    .eq('geography', 'County')
    .limit(100);

  const uniqueCombos = new Set(combos?.map(r => `${r.property_type}|${r.tier}`));
  console.log('Unique property_type|tier combinations:');
  [...uniqueCombos].forEach(c => console.log(`  ${c}`));

  // Check the crosswalk for LA County's Zillow ID
  console.log('\n--- LA County in crosswalk ---');
  const { data: crosswalk } = await supabase
    .from('geography_crosswalk')
    .select('county_fips, county_name, zillow_county_region_id')
    .eq('county_fips', '06037')
    .limit(1);

  if (crosswalk?.[0]) {
    console.log('LA County crosswalk:');
    console.log(`  FIPS: ${crosswalk[0].county_fips}`);
    console.log(`  Name: ${crosswalk[0].county_name}`);
    console.log(`  Zillow ID: ${crosswalk[0].zillow_county_region_id}`);

    // Search by Zillow ID
    const zillowId = String(crosswalk[0].zillow_county_region_id);
    const { data: byZillowId } = await supabase
      .from('zillow_zhvi')
      .select('*')
      .eq('geography', 'County')
      .eq('region_id', zillowId)
      .limit(5);

    console.log(`\nBy Zillow ID ${zillowId}:`, byZillowId?.length || 0, 'records');
    if (byZillowId?.[0]) console.log('Sample:', byZillowId[0]);
  }

  // Check total County records and what's in the top counties by record count
  console.log('\n--- Top counties by record count ---');
  let allCountyData: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('zillow_zhvi')
      .select('region_id')
      .eq('geography', 'County')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allCountyData = allCountyData.concat(data);
    page++;
    if (data.length < 1000) break;
  }

  const countByRegion: Record<string, number> = {};
  allCountyData.forEach(r => {
    countByRegion[r.region_id] = (countByRegion[r.region_id] || 0) + 1;
  });

  const sorted = Object.entries(countByRegion).sort((a, b) => b[1] - a[1]);
  console.log('Top 20 counties by record count:');
  for (const [regionId, count] of sorted.slice(0, 20)) {
    // Get county name
    const { data: nameData } = await supabase
      .from('geography_crosswalk')
      .select('county_name, state_abbrev')
      .eq('county_fips', regionId)
      .limit(1);
    const name = nameData?.[0] ? `${nameData[0].county_name}, ${nameData[0].state_abbrev}` : 'Unknown';
    console.log(`  ${regionId}: ${count} records - ${name}`);
  }
}

check();
