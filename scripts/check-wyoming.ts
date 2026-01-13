import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWyoming() {
  console.log('='.repeat(60));
  console.log('CHECKING WYOMING DATA');
  console.log('='.repeat(60));

  // 1. Check if Wyoming exists in zillow_zhvi for State geography
  // Wyoming's zillow_state_region_id is 58
  console.log('\n1. Checking zillow_zhvi for Wyoming (region_id=58)...');
  const { data: stateData, error: stateError } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date, property_type, tier')
    .eq('geography', 'State')
    .eq('region_id', '58')
    .order('date', { ascending: false })
    .limit(5);

  if (stateError) {
    console.log('   Error:', stateError.message);
  } else if (stateData && stateData.length > 0) {
    console.log('   Found Wyoming state data:');
    stateData.forEach(row => {
      console.log(`   - region_id: ${row.region_id}, value: $${row.value?.toLocaleString()}, date: ${row.date}, tier: ${row.tier}`);
    });
  } else {
    console.log('   NO Wyoming state data found (region_id=58)!');
  }

  // 2. Check all unique state region_ids in zillow_zhvi
  console.log('\n2. Listing all state region_ids in zillow_zhvi...');
  const { data: allStates, error: allStatesError } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'State')
    .eq('tier', '0.33_0.67')
    .eq('property_type', 'sfrcondo')
    .order('region_id');

  if (allStatesError) {
    console.log('   Error:', allStatesError.message);
  } else if (allStates) {
    const uniqueRegionIds = [...new Set(allStates.map(s => s.region_id))].sort((a, b) => Number(a) - Number(b));
    console.log(`   Total unique region_ids: ${uniqueRegionIds.length}`);
    console.log('   Region IDs:', uniqueRegionIds.join(', '));

    // Check if Wyoming (58) is in the list
    const hasWyoming = uniqueRegionIds.includes('58');
    console.log(`\n   Wyoming (region_id=58) present: ${hasWyoming ? 'YES' : 'NO'}`);
  }

  // 3. Check the GeoJSON state names for comparison
  console.log('\n3. Expected state name format for GeoJSON matching...');
  console.log('   GeoJSON uses full state names like "Wyoming" (not abbreviations)');

  // 4. Check geography_crosswalk for Wyoming
  console.log('\n4. Checking geography_crosswalk for Wyoming...');
  const { data: crosswalkData, error: crosswalkError } = await supabase
    .from('geography_crosswalk')
    .select('state_name, state_abbrev, state_fips, zillow_state_region_id')
    .eq('state_abbrev', 'WY')
    .limit(5);

  if (crosswalkError) {
    console.log('   Error:', crosswalkError.message);
  } else if (crosswalkData && crosswalkData.length > 0) {
    console.log('   Found Wyoming in crosswalk:');
    const sample = crosswalkData[0];
    console.log(`   - state_name: ${sample.state_name}`);
    console.log(`   - state_abbrev: ${sample.state_abbrev}`);
    console.log(`   - state_fips: ${sample.state_fips}`);
    console.log(`   - zillow_state_region_id: ${sample.zillow_state_region_id}`);
  } else {
    console.log('   NO Wyoming found in geography_crosswalk!');
  }

  // 5. Sample state records from zillow_zhvi
  console.log('\n5. Sample of state records from zillow_zhvi...');
  const { data: sampleStates } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date, property_type, tier')
    .eq('geography', 'State')
    .eq('tier', '0.33_0.67')
    .eq('property_type', 'sfrcondo')
    .order('date', { ascending: false })
    .limit(10);

  if (sampleStates) {
    sampleStates.forEach(s => {
      console.log(`   - region_id: ${s.region_id}, value: $${s.value?.toLocaleString()}, date: ${s.date}`);
    });
  }

  // 6. Check all state region IDs in crosswalk
  console.log('\n6. All state region_ids in crosswalk...');
  const { data: crosswalkStates } = await supabase
    .from('geography_crosswalk')
    .select('state_abbrev, state_name, zillow_state_region_id')
    .not('zillow_state_region_id', 'is', null)
    .limit(100);

  if (crosswalkStates) {
    const uniqueStates = new Map<string, { name: string; regionId: number }>();
    crosswalkStates.forEach(s => {
      if (!uniqueStates.has(s.state_abbrev)) {
        uniqueStates.set(s.state_abbrev, { name: s.state_name, regionId: s.zillow_state_region_id });
      }
    });
    console.log(`   Unique states with zillow_state_region_id: ${uniqueStates.size}`);
    [...uniqueStates.entries()].sort((a, b) => a[1].regionId - b[1].regionId).forEach(([abbrev, info]) => {
      console.log(`   - ${abbrev} (${info.name}): region_id = ${info.regionId}`);
    });
  }
}

checkWyoming().catch(console.error);
