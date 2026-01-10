/**
 * Verify region_id mapping between markets and zillow_zhvi
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function verify() {
  console.log('=== Verifying Region ID Mapping ===\n');

  // Get state markets
  const { data: markets } = await supabase
    .from('markets')
    .select('region_id, region_name')
    .eq('region_type', 'state');

  console.log(`Found ${markets?.length} state markets`);

  // Get unique ZHVI region_ids
  const { data: zhvi } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'State')
    .limit(1000);

  const zhviRegionIds = [...new Set(zhvi?.map(z => z.region_id) || [])];
  console.log(`Found ${zhviRegionIds.length} unique ZHVI region_ids:`, zhviRegionIds.join(', '));

  // Check which markets match ZHVI region_ids
  console.log('\n--- Matching region_ids ---');
  const matches: string[] = [];
  const noMatch: string[] = [];

  for (const zhviId of zhviRegionIds) {
    const market = markets?.find(m => m.region_id === zhviId);
    if (market) {
      matches.push(`${zhviId} → ${market.region_name}`);
    } else {
      noMatch.push(zhviId);
    }
  }

  console.log(`\nMatched ${matches.length} region_ids:`);
  matches.forEach(m => console.log(`  ${m}`));

  if (noMatch.length > 0) {
    console.log(`\nNo match for ${noMatch.length} region_ids:`, noMatch.join(', '));
  }

  // Test the full query (like backend)
  console.log('\n\n=== Testing Full Query ===');

  const regionNameMap = new Map<string, string>();
  for (const market of markets || []) {
    regionNameMap.set(market.region_id, market.region_name);
  }
  console.log('Market region_ids (sample):', [...regionNameMap.keys()].slice(0, 10).join(', '));

  // Get recent ZHVI
  const { data: recentZhvi, error } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date')
    .eq('geography', 'State')
    .eq('property_type', 'sfrcondo')
    .order('date', { ascending: false })
    .limit(1000);

  if (error) {
    console.log('ZHVI query error:', error.message);
    return;
  }

  console.log(`Got ${recentZhvi?.length} ZHVI records`);

  // Build result
  const result: Record<string, number> = {};
  const seenStates = new Set<string>();

  for (const record of recentZhvi || []) {
    if (seenStates.has(record.region_id)) continue;
    seenStates.add(record.region_id);

    const stateName = regionNameMap.get(record.region_id);
    if (stateName && record.value) {
      result[stateName] = Math.round(Number(record.value));
    }
  }

  console.log(`\nResult: ${Object.keys(result).length} states with values`);
  console.log('\nSample output:');
  Object.entries(result).slice(0, 10).forEach(([state, value]) => {
    console.log(`  ${state}: $${value.toLocaleString()}`);
  });

  if (Object.keys(result).length === 0) {
    console.log('\n⚠️ No matches! The region_id formats likely don\'t match.');
  }
}

verify();
