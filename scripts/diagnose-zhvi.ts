/**
 * Diagnose ZHVI Setup
 *
 * Checks if the data and permissions are correctly set up
 *
 * Usage:
 *   npx tsx scripts/diagnose-zhvi.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

console.log('Connecting to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function diagnose() {
  console.log('\n=== ZHVI Setup Diagnostics ===\n');

  // 1. Check markets table for state records
  console.log('1. Checking markets table for state records...');
  const { data: stateMarkets, error: marketsError, count: marketsCount } = await supabase
    .from('markets')
    .select('*', { count: 'exact' })
    .eq('region_type', 'state')
    .limit(5);

  if (marketsError) {
    console.error('   ERROR querying markets:', marketsError.message);
    console.error('   Code:', marketsError.code);
  } else {
    console.log(`   Found ${marketsCount} state records in markets table`);
    if (stateMarkets && stateMarkets.length > 0) {
      console.log('   Sample:', stateMarkets.slice(0, 3).map(m => `${m.region_id}: ${m.region_name}`).join(', '));
    }
  }

  // 2. Check zillow_zhvi table
  console.log('\n2. Checking zillow_zhvi table...');
  const { data: zhviData, error: zhviError, count: zhviCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact' })
    .eq('geography', 'state')
    .eq('property_type', 'all_homes')
    .limit(5);

  if (zhviError) {
    console.error('   ERROR querying zillow_zhvi:', zhviError.message);
    console.error('   Code:', zhviError.code);
    console.error('   Details:', zhviError.details);
    console.error('   Hint:', zhviError.hint);
  } else {
    console.log(`   Found ${zhviCount} state ZHVI records`);
    if (zhviData && zhviData.length > 0) {
      console.log('   Sample data:');
      console.table(zhviData.slice(0, 3).map(d => ({
        region_id: d.region_id,
        date: d.date,
        value: d.value
      })));
    }
  }

  // 3. Test the exact query from markets.service.ts
  console.log('\n3. Testing API query pattern...');

  // First query - get state markets
  const { data: markets, error: mErr } = await supabase
    .from('markets')
    .select('region_id, region_name')
    .eq('region_type', 'state');

  if (mErr) {
    console.error('   ERROR on markets query:', mErr.message);
  } else {
    console.log(`   Markets query returned ${markets?.length || 0} states`);
  }

  // Second query - get ZHVI data
  const { data: zhvi, error: zErr } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date')
    .eq('geography', 'state')
    .eq('property_type', 'all_homes')
    .order('date', { ascending: false });

  if (zErr) {
    console.error('   ERROR on ZHVI query:', zErr.message);
  } else {
    console.log(`   ZHVI query returned ${zhvi?.length || 0} records`);
  }

  // Build result
  if (markets && zhvi) {
    const regionNameMap = new Map<string, string>();
    for (const market of markets) {
      regionNameMap.set(market.region_id, market.region_name);
    }

    const result: Record<string, number> = {};
    const seenStates = new Set<string>();

    for (const record of zhvi) {
      if (seenStates.has(record.region_id)) continue;
      seenStates.add(record.region_id);

      const stateName = regionNameMap.get(record.region_id);
      if (stateName && record.value) {
        result[stateName] = Math.round(Number(record.value));
      }
    }

    console.log(`\n   Final result: ${Object.keys(result).length} states with values`);
    console.log('   Sample output:');
    const sample = Object.entries(result).slice(0, 5);
    for (const [state, value] of sample) {
      console.log(`     ${state}: $${value.toLocaleString()}`);
    }
  }

  console.log('\n=== Diagnostics Complete ===\n');
}

diagnose().catch(console.error);
