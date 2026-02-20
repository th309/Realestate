/**
 * Fix County Data Issues v2
 *
 * Analysis of the "missing" region_ids:
 * - 02261: Alaska Valdez-Cordova Census Area (valid FIPS) - need to add to crosswalk
 * - 09001-09015: Connecticut Planning Regions (valid FIPS) - need to add to crosswalk
 * - 207, 386, 401, 445, 1347, 2049, 2825, 2832: These are NOT FIPS codes - they're
 *   Zillow's internal region IDs. We should NOT try to match them as FIPS codes.
 *
 * Previous script incorrectly added leading zeros to Zillow IDs. This script:
 * 1. Reverts those changes
 * 2. Adds CT planning regions properly
 * 3. Adds missing Alaska regions
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

const supabase = createClient(supabaseUrl, supabaseKey);

// These were incorrectly "fixed" - revert them
const revertMappings: Record<string, string> = {
  '00207': '207',
  '00386': '386',
  '00401': '401',
  '00445': '445',
  '01347': '1347',
  '02049': '2049',
  '02825': '2825',
  '02832': '2832',
};

// Connecticut Planning Regions (replaced traditional counties in 2022)
const ctPlanningRegions = [
  { fips: '09001', name: 'Capitol Planning Region', population: 967000 },
  { fips: '09003', name: 'Greater Bridgeport Planning Region', population: 940000 },
  { fips: '09005', name: 'Lower Connecticut River Valley Planning Region', population: 180000 },
  { fips: '09007', name: 'Naugatuck Valley Planning Region', population: 350000 },
  { fips: '09009', name: 'Northeastern Connecticut Planning Region', population: 120000 },
  { fips: '09011', name: 'Northwest Hills Planning Region', population: 195000 },
  { fips: '09013', name: 'South Central Connecticut Planning Region', population: 615000 },
  { fips: '09015', name: 'Western Connecticut Planning Region', population: 455000 },
];

// Alaska census area that's missing
const alaskaRegion = { fips: '02261', name: 'Valdez-Cordova Census Area', population: 9202 };

async function revertBadFipsChanges() {
  console.log('='.repeat(70));
  console.log('REVERTING INCORRECT FIPS CHANGES');
  console.log('='.repeat(70));
  console.log('\nThese IDs are Zillow region IDs, not FIPS codes.\n');

  for (const [badFips, originalId] of Object.entries(revertMappings)) {
    const { count } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('region_id', badFips)
      .eq('geography', 'County');

    if (count && count > 0) {
      console.log(`   Reverting ${badFips} → ${originalId} (${count} records)...`);

      const { error } = await supabase
        .from('zillow_zhvi')
        .update({ region_id: originalId })
        .eq('region_id', badFips)
        .eq('geography', 'County');

      if (error) {
        console.log(`   ✗ Error: ${error.message}`);
      } else {
        console.log(`   ✓ Reverted ${count} records`);
      }
    } else {
      console.log(`   ${badFips} - no records to revert`);
    }
  }
}

async function addCtPlanningRegions() {
  console.log('\n' + '='.repeat(70));
  console.log('ADDING CONNECTICUT PLANNING REGIONS');
  console.log('='.repeat(70));

  for (const region of ctPlanningRegions) {
    // Check if exists
    const { count } = await supabase
      .from('geography_crosswalk')
      .select('*', { count: 'exact', head: true })
      .eq('county_fips', region.fips);

    if (count && count > 0) {
      console.log(`   ${region.fips} (${region.name}) - already exists`);
      continue;
    }

    console.log(`   Adding ${region.fips} (${region.name})...`);

    const { error } = await supabase
      .from('geography_crosswalk')
      .insert({
        zip_code: `${region.fips}00`,  // Placeholder
        zip_default_city: region.name.replace(' Planning Region', ''),
        zip_default_state: 'CT',
        county_fips: region.fips,
        county_fips_3: region.fips.slice(-3),
        county_name: region.name,
        county_population: region.population,
        state_fips: '09',
        state_abbrev: 'CT',
        state_name: 'Connecticut',
        cbsa_code: null,
        cbsa_name: null,
        cbsa_type: null,
        cbsa_population: null,
        zillow_state_region_id: 8,  // CT state ID
        zillow_county_region_id: parseInt(region.fips),  // Use FIPS as Zillow ID
        zillow_metro_region_id: null,
        zillow_metro_name: null,
      });

    if (error) {
      console.log(`   ✗ Error: ${error.message}`);
    } else {
      console.log(`   ✓ Added ${region.name}`);
    }
  }
}

async function addAlaskaRegion() {
  console.log('\n' + '='.repeat(70));
  console.log('ADDING ALASKA CENSUS AREA');
  console.log('='.repeat(70));

  const { count } = await supabase
    .from('geography_crosswalk')
    .select('*', { count: 'exact', head: true })
    .eq('county_fips', alaskaRegion.fips);

  if (count && count > 0) {
    console.log(`   ${alaskaRegion.fips} (${alaskaRegion.name}) - already exists`);
    return;
  }

  console.log(`   Adding ${alaskaRegion.fips} (${alaskaRegion.name})...`);

  const { error } = await supabase
    .from('geography_crosswalk')
    .insert({
      zip_code: `${alaskaRegion.fips}00`,
      zip_default_city: 'Valdez',
      zip_default_state: 'AK',
      county_fips: alaskaRegion.fips,
      county_fips_3: alaskaRegion.fips.slice(-3),
      county_name: alaskaRegion.name,
      county_population: alaskaRegion.population,
      state_fips: '02',
      state_abbrev: 'AK',
      state_name: 'Alaska',
      cbsa_code: null,
      cbsa_name: null,
      cbsa_type: null,
      cbsa_population: null,
      zillow_state_region_id: 59,  // AK state ID
      zillow_county_region_id: parseInt(alaskaRegion.fips),
      zillow_metro_region_id: null,
      zillow_metro_name: null,
    });

  if (error) {
    console.log(`   ✗ Error: ${error.message}`);
  } else {
    console.log(`   ✓ Added ${alaskaRegion.name}`);
  }
}

async function analyzeRemainingGaps() {
  console.log('\n' + '='.repeat(70));
  console.log('ANALYZING REMAINING DATA GAPS');
  console.log('='.repeat(70));

  // Get ZHVI region_ids
  const zhviRegionIds = new Set<string>();
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from('zillow_zhvi')
      .select('region_id')
      .eq('geography', 'County')
      .range(offset, offset + pageSize - 1);

    if (data && data.length > 0) {
      data.forEach(d => zhviRegionIds.add(String(d.region_id)));
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  // Get crosswalk FIPS
  const crosswalkFips = new Set<string>();
  offset = 0;
  hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from('geography_crosswalk')
      .select('county_fips')
      .range(offset, offset + pageSize - 1);

    if (data && data.length > 0) {
      data.forEach(d => {
        if (d.county_fips) crosswalkFips.add(d.county_fips);
      });
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  const zhviNotInCrosswalk = [...zhviRegionIds].filter(id => !crosswalkFips.has(id));
  const fipsPattern = [...zhviNotInCrosswalk].filter(id => /^\d{5}$/.test(id));
  const zillowIds = [...zhviNotInCrosswalk].filter(id => !/^\d{5}$/.test(id));

  console.log(`\n   Total unique ZHVI county region_ids: ${zhviRegionIds.size}`);
  console.log(`   Crosswalk FIPS codes: ${crosswalkFips.size}`);
  console.log(`   ZHVI IDs not in crosswalk: ${zhviNotInCrosswalk.length}`);
  console.log(`\n   Breakdown:`);
  console.log(`   - Valid 5-digit FIPS format: ${fipsPattern.length} → ${fipsPattern.join(', ') || 'none'}`);
  console.log(`   - Zillow internal IDs (not FIPS): ${zillowIds.length} → ${zillowIds.join(', ') || 'none'}`);

  if (zillowIds.length > 0) {
    console.log(`\n   Note: Zillow internal IDs (${zillowIds.join(', ')}) cannot be mapped to FIPS.`);
    console.log(`   These represent ~${zillowIds.length} counties that Zillow uses non-standard IDs for.`);
    console.log(`   This is expected - Zillow doesn't always use FIPS codes as region_id.`);
  }

  // Calculate final stats
  const matchedFips = [...zhviRegionIds].filter(id => crosswalkFips.has(id));
  console.log(`\n   FINAL MATCH RATE: ${matchedFips.length}/${zhviRegionIds.size} (${((matchedFips.length / zhviRegionIds.size) * 100).toFixed(1)}%)`);
}

async function main() {
  console.log('County Data Fix v2\n');
  console.log('This script corrects the previous fixes and properly handles:');
  console.log('- Zillow internal IDs (leave as-is, they\'re not FIPS codes)');
  console.log('- Connecticut Planning Regions (add to crosswalk)');
  console.log('- Missing Alaska regions (add to crosswalk)\n');

  await revertBadFipsChanges();
  await addCtPlanningRegions();
  await addAlaskaRegion();
  await analyzeRemainingGaps();

  console.log('\n' + '='.repeat(70));
  console.log('COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
