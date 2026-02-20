/**
 * Diagnostic script for sidebar data display issues
 * Run with: npx tsx scripts/diagnose-data-display.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pysflbhpqnwoczyuaaif.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || (() => { throw new Error('SUPABASE_ANON_KEY is required'); })();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnose() {
  console.log('=== PropertyIQ Data Display Diagnostics ===\n');

  // 1. Test Supabase connection
  console.log('1. Testing Supabase connection...');
  try {
    const { data, error } = await supabase.from('zillow_zhvi').select('count').limit(1);
    if (error) throw error;
    console.log('   ✓ Supabase connection OK\n');
  } catch (e: any) {
    console.log(`   ✗ Supabase connection FAILED: ${e.message}\n`);
    return;
  }

  // 2. Check zillow_zhvi table for State data
  console.log('2. Checking zillow_zhvi table (State level)...');
  const { data: stateData, error: stateError } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date, geography')
    .eq('geography', 'State')
    .eq('property_type', 'sfrcondo')
    .eq('tier', '0.33_0.67')
    .order('date', { ascending: false })
    .limit(5);

  if (stateError) {
    console.log(`   ✗ Error: ${stateError.message}`);
  } else if (!stateData?.length) {
    console.log('   ✗ No State-level ZHVI data found');
  } else {
    console.log(`   ✓ Found ${stateData.length} state records`);
    console.log(`   Sample: region_id=${stateData[0].region_id}, value=${stateData[0].value}, date=${stateData[0].date}`);
  }
  console.log();

  // 3. Check zillow_zhvi table for Metro data
  console.log('3. Checking zillow_zhvi table (Metro level)...');
  const { data: metroData, error: metroError } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date, geography')
    .eq('geography', 'Metro')
    .eq('property_type', 'sfrcondo')
    .eq('tier', '0.33_0.67')
    .order('date', { ascending: false })
    .limit(5);

  if (metroError) {
    console.log(`   ✗ Error: ${metroError.message}`);
  } else if (!metroData?.length) {
    console.log('   ✗ No Metro-level ZHVI data found');
  } else {
    console.log(`   ✓ Found ${metroData.length} metro records`);
    console.log(`   Sample: region_id=${metroData[0].region_id}, value=${metroData[0].value}, date=${metroData[0].date}`);
  }
  console.log();

  // 4. Check geography_crosswalk for CBSA codes
  console.log('4. Checking geography_crosswalk table for CBSA mappings...');
  const { data: crosswalkData, error: crosswalkError } = await supabase
    .from('geography_crosswalk')
    .select('cbsa_code, cbsa_name, zillow_metro_region_id, state_abbrev')
    .not('cbsa_code', 'is', null)
    .limit(5);

  if (crosswalkError) {
    console.log(`   ✗ Error: ${crosswalkError.message}`);
  } else if (!crosswalkData?.length) {
    console.log('   ✗ No CBSA crosswalk data found');
  } else {
    console.log(`   ✓ Found ${crosswalkData.length} CBSA mappings`);
    crosswalkData.forEach(row => {
      console.log(`   - CBSA ${row.cbsa_code}: ${row.cbsa_name} (Zillow ID: ${row.zillow_metro_region_id})`);
    });
  }
  console.log();

  // 5. Check if zillow_metro_crosswalk table exists
  console.log('5. Checking zillow_metro_crosswalk table...');
  const { data: metroCrosswalk, error: metroCrosswalkError } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, zillow_region_name, cbsa_code')
    .limit(5);

  if (metroCrosswalkError) {
    console.log(`   ✗ Table may not exist or error: ${metroCrosswalkError.message}`);
  } else if (!metroCrosswalk?.length) {
    console.log('   ⚠ Table exists but is empty - needs data import');
  } else {
    console.log(`   ✓ Found ${metroCrosswalk.length} records`);
    metroCrosswalk.forEach(row => {
      console.log(`   - Zillow ${row.zillow_region_id}: ${row.zillow_region_name} -> CBSA ${row.cbsa_code}`);
    });
  }
  console.log();

  // 6. Test Metro data join - can we map Zillow IDs to CBSA codes?
  console.log('6. Testing Metro ID to CBSA code mapping...');
  if (metroData?.length && crosswalkData?.length) {
    const sampleMetroId = metroData[0].region_id;

    // Check if this Zillow metro ID has a CBSA mapping
    const { data: mapping } = await supabase
      .from('geography_crosswalk')
      .select('cbsa_code, cbsa_name')
      .eq('zillow_metro_region_id', sampleMetroId)
      .limit(1);

    if (mapping?.length) {
      console.log(`   ✓ Zillow Metro ID ${sampleMetroId} maps to CBSA ${mapping[0].cbsa_code} (${mapping[0].cbsa_name})`);
    } else {
      console.log(`   ✗ Zillow Metro ID ${sampleMetroId} has NO CBSA mapping in geography_crosswalk`);
      console.log('   This is likely why data is not displaying on the map!');
    }
  }
  console.log();

  // 7. Check latest dates
  console.log('7. Checking latest data dates...');
  const { data: latestDate } = await supabase
    .from('zillow_zhvi')
    .select('date')
    .eq('geography', 'Metro')
    .order('date', { ascending: false })
    .limit(1);

  if (latestDate?.length) {
    console.log(`   Latest Metro ZHVI date: ${latestDate[0].date}`);
  }

  console.log('\n=== Diagnostics Complete ===');
}

diagnose().catch(console.error);
