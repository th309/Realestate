/**
 * Quick check of geography_crosswalk data for all geo levels
 * Run: npx tsx scripts/check-crosswalk-mapping.ts
 */

import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS
const supabase = createClient(
  'https://pysflbhpqnwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })()
);

async function checkCrosswalk() {
  console.log('=== Geography Crosswalk Data Check ===\n');

  // 1. Check State mappings
  console.log('1. STATE LEVEL - zillow_state_region_id mappings:');
  const { data: states, count: stateCount } = await supabase
    .from('geography_crosswalk')
    .select('state_abbrev, state_name, zillow_state_region_id', { count: 'exact' })
    .not('zillow_state_region_id', 'is', null)
    .limit(5);
  console.log(`   Found ${stateCount || 0} rows with zillow_state_region_id`);
  if (states?.length) {
    states.slice(0, 3).forEach(s => console.log(`   - ${s.state_abbrev}: ${s.state_name} (Zillow ID: ${s.zillow_state_region_id})`));
  }
  console.log();

  // 2. Check Metro/CBSA mappings
  console.log('2. METRO LEVEL - cbsa_code + zillow_metro_region_id mappings:');
  const { data: metros, count: metroCount } = await supabase
    .from('geography_crosswalk')
    .select('cbsa_code, cbsa_name, zillow_metro_region_id, state_abbrev', { count: 'exact' })
    .not('cbsa_code', 'is', null)
    .limit(1000);

  const withZillowId = metros?.filter(m => m.zillow_metro_region_id) || [];
  console.log(`   Total rows with cbsa_code: ${metroCount || 0}`);
  console.log(`   Rows with zillow_metro_region_id: ${withZillowId.length}`);
  if (withZillowId.length > 0) {
    console.log('   Sample mappings:');
    withZillowId.slice(0, 5).forEach(m =>
      console.log(`   - CBSA ${m.cbsa_code}: ${m.cbsa_name} (Zillow ID: ${m.zillow_metro_region_id})`)
    );
  } else {
    console.log('   ⚠️ WARNING: No zillow_metro_region_id values found!');
    console.log('   This means metros cannot be mapped from Zillow IDs to CBSA codes.');
  }
  console.log();

  // 3. Check County FIPS mappings
  console.log('3. COUNTY LEVEL - county_fips mappings:');
  const { count: countyCount } = await supabase
    .from('geography_crosswalk')
    .select('county_fips', { count: 'exact' })
    .not('county_fips', 'is', null);
  console.log(`   Found ${countyCount || 0} rows with county_fips`);
  console.log();

  // 4. Check ZIP mappings
  console.log('4. ZIP LEVEL - zip_code mappings:');
  const { count: zipCount } = await supabase
    .from('geography_crosswalk')
    .select('zip_code', { count: 'exact' })
    .not('zip_code', 'is', null);
  console.log(`   Found ${zipCount || 0} rows with zip_code`);
  console.log();

  // 5. Check zillow_zhvi data availability
  console.log('5. ZILLOW DATA AVAILABILITY (zillow_zhvi):');
  const geoLevels = ['State', 'Metro', 'County', 'City', 'Zip'];
  for (const geo of geoLevels) {
    const { count } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geo)
      .eq('property_type', 'sfrcondo');
    console.log(`   ${geo}: ${count || 0} records`);
  }
  console.log();

  // 6. Check if zillow_metro_crosswalk table exists and has data
  console.log('6. ZILLOW_METRO_CROSSWALK TABLE (from migration 035):');
  const { data: metroCrosswalk, error } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, zillow_region_name, cbsa_code')
    .limit(5);

  if (error) {
    console.log(`   ⚠️ Table error: ${error.message}`);
  } else if (!metroCrosswalk?.length) {
    console.log('   ⚠️ Table exists but is EMPTY - needs data import!');
  } else {
    console.log(`   ✓ Table has data. Sample:`);
    metroCrosswalk.forEach(m =>
      console.log(`   - Zillow ${m.zillow_region_id}: ${m.zillow_region_name} -> CBSA ${m.cbsa_code}`)
    );
  }

  console.log('\n=== Check Complete ===');
}

checkCrosswalk().catch(console.error);
