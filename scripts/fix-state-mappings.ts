import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseKey);

// Zillow state region IDs - these are Zillow's internal IDs for each state
// Source: Zillow API documentation / known mappings
const ZILLOW_STATE_MAPPINGS: Record<string, number> = {
  'AL': 3,
  'AK': 60,
  'AZ': 4,
  'AR': 5,
  'CA': 9,
  'CO': 6,
  'CT': 8,
  'DE': 10,
  'DC': 11,
  'FL': 14,
  'GA': 12,
  'HI': 15,
  'ID': 16,
  'IL': 17,
  'IN': 18,
  'IA': 19,
  'KS': 20,
  'KY': 21,
  'LA': 22,
  'ME': 23,
  'MD': 24,
  'MA': 25,
  'MI': 26,
  'MN': 27,
  'MS': 28,
  'MO': 29,
  'MT': 30,
  'NE': 31,
  'NV': 32,
  'NH': 33,
  'NJ': 34,
  'NM': 35,
  'NY': 36,
  'NC': 37,
  'ND': 38,
  'OH': 39,
  'OK': 40,
  'OR': 41,
  'PA': 42,
  'RI': 43,
  'SC': 44,
  'SD': 45,
  'TN': 46,
  'TX': 47,
  'UT': 48,
  'VT': 49,
  'VA': 50,
  'WA': 51,
  'WV': 52,
  'WI': 53,
  'WY': 58,
  'PR': 61,
  'VI': 62,
};

async function checkAndFixStateMappings() {
  console.log('='.repeat(70));
  console.log('CHECKING AND FIXING STATE ZILLOW MAPPINGS');
  console.log('='.repeat(70));

  // 1. Get current state of mappings in crosswalk
  console.log('\n1. Checking current state mappings in crosswalk...');
  const statesWithMapping = new Map<string, number>();
  const statesWithoutMapping = new Set<string>();

  for (const [stateAbbrev, zillowId] of Object.entries(ZILLOW_STATE_MAPPINGS)) {
    const { data } = await supabase
      .from('geography_crosswalk')
      .select('zillow_state_region_id')
      .eq('state_abbrev', stateAbbrev)
      .limit(1);

    if (data && data.length > 0) {
      if (data[0].zillow_state_region_id) {
        statesWithMapping.set(stateAbbrev, data[0].zillow_state_region_id);
      } else {
        statesWithoutMapping.add(stateAbbrev);
      }
    }
  }

  console.log(`   States WITH zillow_state_region_id: ${statesWithMapping.size}`);
  console.log(`   States WITHOUT: ${statesWithoutMapping.size}`);
  console.log(`   Missing: ${[...statesWithoutMapping].sort().join(', ')}`);

  // 2. Verify mappings against zillow_zhvi
  console.log('\n2. Verifying mappings against zillow_zhvi data...');

  const { data: zhviStates } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value')
    .eq('geography', 'State')
    .eq('tier', '0.33_0.67')
    .eq('property_type', 'sfrcondo')
    .order('date', { ascending: false })
    .limit(60);

  const zhviRegionIds = new Set(zhviStates?.map(s => s.region_id) || []);
  console.log(`   Unique state region_ids in zillow_zhvi: ${zhviRegionIds.size}`);

  // Check which of our mappings exist in ZHVI
  let matchCount = 0;
  let missingFromZhvi: string[] = [];
  for (const [state, zillowId] of Object.entries(ZILLOW_STATE_MAPPINGS)) {
    if (zhviRegionIds.has(String(zillowId))) {
      matchCount++;
    } else {
      missingFromZhvi.push(`${state} (${zillowId})`);
    }
  }
  console.log(`   Mappings matching ZHVI data: ${matchCount}/${Object.keys(ZILLOW_STATE_MAPPINGS).length}`);
  if (missingFromZhvi.length > 0) {
    console.log(`   Not in ZHVI: ${missingFromZhvi.join(', ')}`);
  }

  // 3. Update missing mappings
  console.log('\n3. Updating missing state mappings in crosswalk...');
  let updateCount = 0;
  let errorCount = 0;

  for (const stateAbbrev of statesWithoutMapping) {
    const zillowId = ZILLOW_STATE_MAPPINGS[stateAbbrev];
    if (!zillowId) continue;

    const { error } = await supabase
      .from('geography_crosswalk')
      .update({ zillow_state_region_id: zillowId })
      .eq('state_abbrev', stateAbbrev);

    if (error) {
      console.log(`   ✗ Error updating ${stateAbbrev}: ${error.message}`);
      errorCount++;
    } else {
      console.log(`   ✓ Updated ${stateAbbrev} → zillow_state_region_id: ${zillowId}`);
      updateCount++;
    }
  }

  console.log(`\n   Updated: ${updateCount} states`);
  console.log(`   Errors: ${errorCount}`);

  // 4. Verify fix
  console.log('\n4. Verifying fix...');
  let verifyCount = 0;
  for (const stateAbbrev of statesWithoutMapping) {
    const { data } = await supabase
      .from('geography_crosswalk')
      .select('zillow_state_region_id')
      .eq('state_abbrev', stateAbbrev)
      .limit(1);

    if (data && data[0]?.zillow_state_region_id) {
      verifyCount++;
    }
  }
  console.log(`   Verified: ${verifyCount}/${statesWithoutMapping.size} states now have mappings`);

  console.log('\n' + '='.repeat(70));
  console.log('COMPLETE');
  console.log('='.repeat(70));
}

checkAndFixStateMappings().catch(console.error);
