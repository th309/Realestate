import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  // CA counties in zillow_zhvi
  console.log('--- CA Counties in zillow_zhvi ---');
  const { data: caData } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'County')
    .like('region_id', '06%');

  const caCounties = [...new Set(caData?.map(r => r.region_id) || [])];
  console.log('CA counties with ZHVI data:', caCounties.length);
  console.log('FIPS codes:', caCounties.sort());

  // Map to county names via crosswalk
  console.log('\nCounty names for CA counties in ZHVI:');
  for (const fips of caCounties.sort()) {
    const { data } = await supabase
      .from('geography_crosswalk')
      .select('county_name')
      .eq('county_fips', fips)
      .limit(1);
    console.log(`  ${fips}: ${data?.[0]?.county_name || 'Unknown'}`);
  }

  // What about TX (48)?
  console.log('\n--- TX Counties in zillow_zhvi ---');
  const { data: txData } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'County')
    .like('region_id', '48%');

  const txCounties = [...new Set(txData?.map(r => r.region_id) || [])];
  console.log('TX counties with ZHVI data:', txCounties.length);

  // FL (12)?
  console.log('\n--- FL Counties in zillow_zhvi ---');
  const { data: flData } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'County')
    .like('region_id', '12%');

  const flCounties = [...new Set(flData?.map(r => r.region_id) || [])];
  console.log('FL counties with ZHVI data:', flCounties.length);

  // State breakdown of all county data
  console.log('\n--- All states with county ZHVI data ---');
  let allCounties: string[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('zillow_zhvi')
      .select('region_id')
      .eq('geography', 'County')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allCounties = allCounties.concat(data.map(r => r.region_id));
    page++;
    if (data.length < 1000) break;
  }

  const uniqueCounties = [...new Set(allCounties)];
  const stateCount: Record<string, number> = {};
  uniqueCounties.forEach(fips => {
    if (fips.length >= 2) {
      const state = fips.substring(0, 2);
      stateCount[state] = (stateCount[state] || 0) + 1;
    }
  });

  // Sort by count descending
  const sorted = Object.entries(stateCount).sort((a, b) => b[1] - a[1]);
  console.log('Counties per state (top 20):');
  sorted.slice(0, 20).forEach(([state, count]) => {
    console.log(`  ${state}: ${count} counties`);
  });

  console.log('\nTotal unique counties with data:', uniqueCounties.length);
}

check();
