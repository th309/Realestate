/**
 * Test the exact query used by the backend API
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testQuery() {
  console.log('=== Testing Backend Query ===\n');

  try {
    // Step 1: Get state markets (exactly like backend)
    console.log('1. Fetching state markets...');
    const { data: stateMarkets, error: marketsError } = await supabase
      .from('markets')
      .select('region_id, region_name')
      .eq('region_type', 'state');

    if (marketsError) {
      console.error('Error fetching state markets:', marketsError);
      return;
    }
    console.log(`   Found ${stateMarkets?.length || 0} state markets`);

    // Step 2: Get ZHVI data (exactly like backend)
    console.log('\n2. Fetching ZHVI data...');
    const { data: zhviData, error: zhviError } = await supabase
      .from('zillow_zhvi')
      .select('region_id, value, date')
      .eq('geography', 'state')
      .eq('property_type', 'all_homes')
      .order('date', { ascending: false });

    if (zhviError) {
      console.error('Error fetching ZHVI data:', zhviError);
      return;
    }
    console.log(`   Found ${zhviData?.length || 0} ZHVI records`);

    // Step 3: Build result (exactly like backend)
    console.log('\n3. Building result...');
    const regionNameMap = new Map<string, string>();
    for (const market of stateMarkets || []) {
      regionNameMap.set(market.region_id, market.region_name);
    }

    const result: Record<string, number> = {};
    const seenStates = new Set<string>();

    for (const record of zhviData || []) {
      if (seenStates.has(record.region_id)) continue;
      seenStates.add(record.region_id);

      const stateName = regionNameMap.get(record.region_id);
      if (stateName && record.value) {
        result[stateName] = Math.round(Number(record.value));
      }
    }

    console.log(`\n4. RESULT: ${Object.keys(result).length} states with values`);

    if (Object.keys(result).length === 0) {
      console.log('\n   ⚠️ No matches! Checking why...');
      console.log('\n   ZHVI region_ids:', [...new Set(zhviData?.map(z => z.region_id) || [])].slice(0, 10).join(', '));
      console.log('   Market region_ids:', stateMarkets?.slice(0, 10).map(m => m.region_id).join(', '));
    } else {
      console.log('\n   Sample values:');
      Object.entries(result).slice(0, 10).forEach(([state, value]) => {
        console.log(`     ${state}: $${value.toLocaleString()}`);
      });

      // Output the full JSON that the API would return
      console.log('\n5. Full API Response (JSON):');
      console.log(JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testQuery();
