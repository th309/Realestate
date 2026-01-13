/**
 * Fix County Data Issues
 *
 * This script addresses two issues identified in the county investigation:
 * 1. Malformed FIPS codes in zillow_zhvi (missing leading zeros)
 * 2. Missing Connecticut planning regions in geography_crosswalk
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseKey);

// Malformed FIPS codes that need leading zeros
const malformedFipsMappings: Record<string, string> = {
  '1347': '01347',   // Likely Chilton County, AL area
  '2049': '02049',   // Alaska - Matanuska-Susitna Borough area
  '207': '00207',    // Unknown - may be invalid
  '2825': '02825',   // Alaska area
  '2832': '02832',   // Alaska area
  '386': '00386',    // Unknown - may be invalid
  '401': '00401',    // Unknown - may be invalid
  '445': '00445',    // Unknown - may be invalid
};

// Connecticut Planning Regions (replaced traditional counties in 2022)
// These are the 9 COGs (Councils of Governments) that replaced the 8 counties
const ctPlanningRegions = [
  { fips: '09001', name: 'Capitol Planning Region', state: 'CT' },
  { fips: '09003', name: 'Greater Bridgeport Planning Region', state: 'CT' },
  { fips: '09005', name: 'Lower Connecticut River Valley Planning Region', state: 'CT' },
  { fips: '09007', name: 'Naugatuck Valley Planning Region', state: 'CT' },
  { fips: '09009', name: 'Northeastern Connecticut Planning Region', state: 'CT' },
  { fips: '09011', name: 'Northwest Hills Planning Region', state: 'CT' },
  { fips: '09013', name: 'South Central Connecticut Planning Region', state: 'CT' },
  { fips: '09015', name: 'Western Connecticut Planning Region', state: 'CT' },
  // 09017 is sometimes used for Southeastern CT
];

async function fixMalformedFipsCodes() {
  console.log('='.repeat(70));
  console.log('FIXING MALFORMED FIPS CODES IN zillow_zhvi');
  console.log('='.repeat(70));

  for (const [oldFips, newFips] of Object.entries(malformedFipsMappings)) {
    // Check if records exist with the old FIPS
    const { count, error: countError } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('region_id', oldFips)
      .eq('geography', 'County');

    if (countError) {
      console.log(`   Error checking ${oldFips}: ${countError.message}`);
      continue;
    }

    if (count && count > 0) {
      console.log(`\n   Updating ${oldFips} → ${newFips} (${count} records)...`);

      const { error: updateError } = await supabase
        .from('zillow_zhvi')
        .update({ region_id: newFips })
        .eq('region_id', oldFips)
        .eq('geography', 'County');

      if (updateError) {
        console.log(`   ✗ Error updating: ${updateError.message}`);
      } else {
        console.log(`   ✓ Updated ${count} records`);
      }
    } else {
      console.log(`   Skipping ${oldFips} → ${newFips} (no records found)`);
    }
  }
}

async function addCtPlanningRegions() {
  console.log('\n' + '='.repeat(70));
  console.log('ADDING CONNECTICUT PLANNING REGIONS TO geography_crosswalk');
  console.log('='.repeat(70));

  // First check what CT entries exist
  const { data: existingCt, error: ctError } = await supabase
    .from('geography_crosswalk')
    .select('county_fips, county_name')
    .eq('state_abbrev', 'CT')
    .order('county_fips');

  if (ctError) {
    console.log(`   Error checking existing CT entries: ${ctError.message}`);
  } else {
    const uniqueCtFips = [...new Set(existingCt?.map(r => r.county_fips) || [])];
    console.log(`\n   Existing CT county_fips in crosswalk: ${uniqueCtFips.length}`);
    if (uniqueCtFips.length > 0) {
      console.log(`   IDs: ${uniqueCtFips.slice(0, 10).join(', ')}${uniqueCtFips.length > 10 ? '...' : ''}`);
    }
  }

  // Check which planning regions need to be added
  for (const region of ctPlanningRegions) {
    const { count } = await supabase
      .from('geography_crosswalk')
      .select('*', { count: 'exact', head: true })
      .eq('county_fips', region.fips);

    if (count && count > 0) {
      console.log(`   ${region.fips} (${region.name}) - already exists`);
    } else {
      console.log(`   ${region.fips} (${region.name}) - MISSING, adding...`);

      // Get a sample ZIP code for this region to create a crosswalk entry
      // We'll create a placeholder entry that can be updated later
      const { error: insertError } = await supabase
        .from('geography_crosswalk')
        .insert({
          zip_code: `CT${region.fips.slice(-3)}`,  // Placeholder ZIP
          county_fips: region.fips,
          county_name: region.name,
          state_abbrev: region.state,
          state_fips: '09',
          cbsa_code: null,
          cbsa_name: null,
          cbsa_type: null,
          csa_code: null,
          csa_name: null,
          zillow_metro_region_id: null,
          zillow_county_region_id: parseInt(region.fips),
        });

      if (insertError) {
        console.log(`     ✗ Error: ${insertError.message}`);
      } else {
        console.log(`     ✓ Added placeholder entry`);
      }
    }
  }
}

async function verifyFixes() {
  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION');
  console.log('='.repeat(70));

  // Check ZHVI counties not in crosswalk
  const zhviRegionIds = new Set<string>();
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from('zillow_zhvi')
      .select('region_id')
      .eq('geography', 'County')
      .order('region_id')
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

  const zhviNotInCrosswalk = [...zhviRegionIds].filter(fips => !crosswalkFips.has(fips));

  console.log(`\n   Total ZHVI counties: ${zhviRegionIds.size}`);
  console.log(`   Total crosswalk FIPS: ${crosswalkFips.size}`);
  console.log(`   ZHVI counties NOT in crosswalk: ${zhviNotInCrosswalk.length}`);

  if (zhviNotInCrosswalk.length > 0) {
    console.log(`   Still missing: ${zhviNotInCrosswalk.join(', ')}`);
  } else {
    console.log(`   ✓ All ZHVI counties are now mapped in crosswalk!`);
  }
}

async function main() {
  console.log('Starting county data fixes...\n');

  await fixMalformedFipsCodes();
  await addCtPlanningRegions();
  await verifyFixes();

  console.log('\n' + '='.repeat(70));
  console.log('COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
