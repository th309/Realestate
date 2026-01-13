import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function debug() {
  console.log('=== Testing crosswalk limit issue ===\n');

  // Simulate what the service does - get first 10000 rows
  const { data: crosswalk } = await supabase
    .from('geography_crosswalk')
    .select('county_fips, county_name, state_abbrev, state_name')
    .not('county_fips', 'is', null)
    .limit(10000);

  console.log('Rows fetched with limit(10000):', crosswalk?.length);

  // Dedupe by county_fips (like the service does)
  const countyMap = new Map<string, any>();
  crosswalk?.forEach(row => {
    if (row.county_fips && !countyMap.has(row.county_fips)) {
      countyMap.set(row.county_fips, {
        fips: row.county_fips,
        name: row.county_name,
        state_abbrev: row.state_abbrev,
        state_name: row.state_name
      });
    }
  });

  console.log('Unique county_fips after dedup:', countyMap.size);

  // Check state distribution
  const stateCount: Record<string, number> = {};
  countyMap.forEach(v => {
    stateCount[v.state_abbrev] = (stateCount[v.state_abbrev] || 0) + 1;
  });

  console.log('\nState distribution:');
  const sorted = Object.entries(stateCount).sort((a, b) => b[1] - a[1]);
  sorted.slice(0, 10).forEach(([state, count]) => {
    console.log(`  ${state}: ${count} counties`);
  });

  // Now check how many of these exist in zillow_zhvi
  const fipsCodes = [...countyMap.keys()];
  console.log('\nFIPS codes to query:', fipsCodes.length);

  // Check matching in zillow_zhvi
  const { count: matchCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County')
    .eq('date', '2025-11-30')
    .eq('property_type', 'sfrcondo')
    .eq('tier', '0.33_0.67')
    .in('region_id', fipsCodes);

  console.log('Matching counties in zillow_zhvi:', matchCount);
}

debug().catch(console.error);
