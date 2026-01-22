/**
 * Test scoring with real database data
 * Deletes existing percentiles and runs the scoring pipeline
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== Testing Scoring with Real Data ===\n');

  // Step 1: Delete all existing percentiles
  console.log('1. Deleting existing metric_percentiles...');
  const { error: deleteError } = await supabase
    .from('metric_percentiles')
    .delete()
    .neq('metric_name', 'NEVER_MATCH');

  if (deleteError) {
    console.error('   Delete error:', deleteError.message);
  } else {
    console.log('   ✓ Deleted all percentiles');
  }

  // Step 2: Check realtor_state data
  console.log('\n2. Checking realtor_state data...');
  const { data: stateData, error: stateError } = await supabase
    .from('realtor_state')
    .select('state_id, period_date, median_listing_price, median_days_on_market, pending_ratio')
    .order('period_date', { ascending: false })
    .limit(5);

  if (stateError) {
    console.error('   Error:', stateError.message);
  } else if (!stateData || stateData.length === 0) {
    console.log('   No realtor_state data found');
  } else {
    console.log(`   Found ${stateData.length} rows. Latest date: ${stateData[0].period_date}`);
    console.log('   Sample:', JSON.stringify(stateData[0], null, 2));
  }

  // Step 3: Get latest date
  const latestDate = stateData?.[0]?.period_date;
  if (!latestDate) {
    console.error('No data found - cannot continue');
    return;
  }

  // Step 4: Count rows for latest date
  console.log(`\n3. Counting states for ${latestDate}...`);
  const { data: allStates } = await supabase
    .from('realtor_state')
    .select('state_id, median_listing_price, median_days_on_market, pending_ratio, active_listing_count_yy')
    .eq('period_date', latestDate);

  console.log(`   Found ${allStates?.length || 0} states`);

  // Step 5: Calculate percentiles manually and show distribution
  if (allStates && allStates.length > 0) {
    console.log('\n4. Calculating sample percentiles for median_days_on_market...');
    const domValues = allStates
      .map(s => s.median_days_on_market)
      .filter(v => v !== null && v !== undefined)
      .sort((a, b) => a - b);

    if (domValues.length >= 5) {
      const getPercentile = (arr: number[], p: number) => {
        const index = Math.floor((p / 100) * arr.length);
        return arr[Math.min(index, arr.length - 1)];
      };

      console.log(`   Values count: ${domValues.length}`);
      console.log(`   Min: ${domValues[0]}, Max: ${domValues[domValues.length - 1]}`);
      console.log(`   p10: ${getPercentile(domValues, 10)}`);
      console.log(`   p50: ${getPercentile(domValues, 50)}`);
      console.log(`   p90: ${getPercentile(domValues, 90)}`);
    }

    // Show some state values to verify variation
    console.log('\n5. Sample state values (showing variation):');
    const sampleStates = allStates.slice(0, 10);
    for (const state of sampleStates) {
      console.log(`   ${state.state_id}: DOM=${state.median_days_on_market}, price=${state.median_listing_price}, pending_ratio=${state.pending_ratio}`);
    }
  }

  // Step 6: Check Zillow data
  console.log('\n6. Checking zillow_state data...');
  const { data: zillowData } = await supabase
    .from('zillow_state')
    .select('state_abbrev, zhvi, zhvi_yoy')
    .order('period_date', { ascending: false })
    .limit(5);

  if (zillowData && zillowData.length > 0) {
    console.log(`   Found Zillow data. Sample: ${zillowData[0].state_abbrev} - ZHVI: ${zillowData[0].zhvi}, YoY: ${zillowData[0].zhvi_yoy}`);
  } else {
    console.log('   No zillow_state data found');
  }

  console.log('\n=== Test Complete ===');
  console.log('\nNext steps:');
  console.log('1. Deploy backend');
  console.log('2. Call POST /api/scoring/percentiles/state');
  console.log('3. Call POST /api/scoring/run-pipeline/state');
  console.log('4. Verify scores vary across states');
}

main().catch(console.error);
