import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log('=== Checking markets table for county FIPS codes ===\n');

  // Check by region_id
  console.log('Checking by region_id:');
  const { data: byRegionId } = await supabase
    .from('markets')
    .select('region_id, region_name, region_type')
    .eq('region_id', '06037')
    .limit(1);
  console.log('06037 by region_id:', byRegionId);

  // Check by county_fips
  console.log('\nChecking by county_fips:');
  const { data: byCountyFips } = await supabase
    .from('markets')
    .select('region_id, region_name, region_type, county_fips')
    .eq('county_fips', '06037')
    .limit(5);
  console.log('06037 by county_fips:', byCountyFips);

  // Check by geoid
  console.log('\nChecking by geoid:');
  const { data: byGeoid } = await supabase
    .from('markets')
    .select('region_id, region_name, region_type, geoid')
    .eq('geoid', '06037')
    .limit(1);
  console.log('06037 by geoid:', byGeoid);

  // See what format region_id is in
  console.log('\n--- Sample markets with region_type = County ---');
  const { data: countyMarkets, count: countyCount } = await supabase
    .from('markets')
    .select('region_id, region_name, region_type, county_fips, geoid', { count: 'exact' })
    .eq('region_type', 'County')
    .limit(10);

  console.log('Total County markets:', countyCount);
  if (countyMarkets && countyMarkets.length > 0) {
    console.log('Sample:');
    countyMarkets.forEach(m => {
      console.log(`  region_id=${m.region_id}, name=${m.region_name}, county_fips=${m.county_fips}, geoid=${m.geoid}`);
    });
  }

  // Check all region_types
  console.log('\n--- All region_types in markets ---');
  const { data: allTypes } = await supabase
    .from('markets')
    .select('region_type')
    .limit(200);

  const types = [...new Set(allTypes?.map(t => t.region_type).filter(Boolean) || [])];
  console.log('Types found:', types);
}

check().catch(console.error);
