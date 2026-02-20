/**
 * Get correct Zillow RegionID to State Name mapping from the database
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function getMapping() {
  console.log('=== Getting Correct Zillow State Mapping ===\n');

  // Get all markets with numeric region_ids (Zillow format) that are states
  const { data: markets } = await supabase
    .from('markets')
    .select('region_id, region_name')
    .eq('region_type', 'state');

  // Filter to just numeric region_ids (Zillow format, not US-XX format)
  const zillowMarkets = markets?.filter(m => /^\d+$/.test(m.region_id)) || [];

  console.log(`Found ${zillowMarkets.length} state markets with Zillow RegionIDs:\n`);

  // Output as a mapping object
  const mapping: Record<string, string> = {};
  zillowMarkets
    .sort((a, b) => parseInt(a.region_id) - parseInt(b.region_id))
    .forEach(m => {
      mapping[m.region_id] = m.region_name;
      console.log(`  '${m.region_id}': '${m.region_name}',`);
    });

  console.log(`\n\nAs JSON:\n${JSON.stringify(mapping, null, 2)}`);

  // Test query with these region_ids
  console.log('\n\n=== Testing Query ===');
  const regionIds = Object.keys(mapping);

  const { data: zhvi, error } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date')
    .in('region_id', regionIds)
    .order('date', { ascending: false })
    .limit(500);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  // Get most recent value per state
  const result: Record<string, number> = {};
  const seenStates = new Set<string>();

  for (const record of zhvi || []) {
    if (seenStates.has(record.region_id)) continue;
    seenStates.add(record.region_id);
    const stateName = mapping[record.region_id];
    if (stateName && record.value) {
      result[stateName] = Math.round(Number(record.value));
    }
  }

  console.log(`\nGot values for ${Object.keys(result).length} states`);
}

getMapping();
