/**
 * Simple approach: Get just 51 state values efficiently
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Zillow RegionID to State Name mapping (from Zillow's data)
const ZILLOW_STATE_MAP: Record<string, string> = {
  '5': 'Colorado',
  '6': 'Connecticut',
  '7': 'Delaware',
  '8': 'Arizona',
  '9': 'California',
  '10': 'Arkansas',
  '11': 'District of Columbia',
  '12': 'Georgia',
  '13': 'Hawaii',
  '14': 'Florida',
  '15': 'Idaho',
  '16': 'Illinois',
  '17': 'Indiana',
  '18': 'Iowa',
  '19': 'Kansas',
  '20': 'Kentucky',
  '21': 'Louisiana',
  '22': 'Maine',
  '23': 'Maryland',
  '24': 'Massachusetts',
  '25': 'Michigan',
  '26': 'Minnesota',
  '27': 'Mississippi',
  '28': 'Missouri',
  '29': 'Montana',
  '30': 'Nebraska',
  '31': 'Nevada',
  '32': 'New Hampshire',
  '33': 'New Jersey',
  '34': 'New Mexico',
  '35': 'New York',
  '36': 'North Carolina',
  '37': 'North Dakota',
  '38': 'Ohio',
  '39': 'Oklahoma',
  '40': 'Oregon',
  '41': 'Pennsylvania',
  '42': 'Rhode Island',
  '43': 'South Carolina',
  '44': 'South Dakota',
  '45': 'Tennessee',
  '46': 'Texas',
  '47': 'Utah',
  '48': 'Vermont',
  '49': 'Virginia',
  '50': 'Washington',
  '51': 'West Virginia',
  '52': 'Wisconsin',
  '53': 'Wyoming',
  '54': 'Alabama',
  '55': 'Alaska',
};

async function simpleQuery() {
  console.log('=== Simple State Query ===\n');

  // Get the specific region_ids we need
  const stateRegionIds = Object.keys(ZILLOW_STATE_MAP);
  console.log(`Querying for ${stateRegionIds.length} state region_ids`);

  // Query with IN clause for specific region_ids
  const { data, error } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date')
    .in('region_id', stateRegionIds)
    .order('date', { ascending: false })
    .limit(500);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log(`Got ${data?.length} records`);

  // Get most recent value per state
  const result: Record<string, number> = {};
  const seenStates = new Set<string>();

  for (const record of data || []) {
    if (seenStates.has(record.region_id)) continue;
    seenStates.add(record.region_id);

    const stateName = ZILLOW_STATE_MAP[record.region_id];
    if (stateName && record.value) {
      result[stateName] = Math.round(Number(record.value));
    }
  }

  console.log(`\nResult: ${Object.keys(result).length} states`);
  console.log('\nAll state values:');
  Object.entries(result)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([state, value]) => {
      console.log(`  ${state}: $${value.toLocaleString()}`);
    });

  console.log('\n\nJSON output:');
  console.log(JSON.stringify(result, null, 2));
}

simpleQuery();
