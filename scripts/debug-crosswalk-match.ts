import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })()
);

async function debug() {
  console.log('='.repeat(70));
  console.log('DEBUG: CROSSWALK MATCHING');
  console.log('='.repeat(70));

  // 1. Check crosswalk table size
  const { count: crosswalkCount } = await supabase
    .from('zillow_metro_crosswalk')
    .select('*', { count: 'exact', head: true });
  console.log('\n1. Crosswalk table entries:', crosswalkCount);

  // 2. Load crosswalk data
  const { data: crosswalkData } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, cbsa_code, zillow_region_name')
    .limit(10000);

  const crosswalkById = new Map<string, string>();
  const crosswalkByName = new Map<string, string>();

  crosswalkData?.forEach(r => {
    if (r.zillow_region_id && r.cbsa_code) {
      crosswalkById.set(String(r.zillow_region_id), r.cbsa_code);
    }
    if (r.zillow_region_name && r.cbsa_code) {
      const normalized = r.zillow_region_name.toLowerCase().replace(/[,\-]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      crosswalkByName.set(normalized, r.cbsa_code);
    }
  });

  console.log('   Crosswalk entries by ID:', crosswalkById.size);
  console.log('   Crosswalk entries by name:', crosswalkByName.size);

  // 3. Load SFR CSV
  const sfrCsv = readFileSync('d:/Projects/rei-platform/data/zillow/Metro_zori_uc_sfr_sm_month.csv', 'utf-8');
  const sfrRows = parse(sfrCsv, { columns: true, skip_empty_lines: true });
  console.log('\n2. SFR CSV rows:', sfrRows.length);

  // 4. Check how many match
  let matchedById = 0;
  let matchedByName = 0;
  let noMatch = 0;
  const unmatchedSamples: string[] = [];

  for (const row of sfrRows) {
    const regionId = String(row['RegionID']);
    const regionName = row['RegionName'];
    const normalized = regionName?.toLowerCase().replace(/[,\-]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

    if (crosswalkById.has(regionId)) {
      matchedById++;
    } else if (crosswalkByName.has(normalized)) {
      matchedByName++;
    } else {
      noMatch++;
      if (unmatchedSamples.length < 20) {
        unmatchedSamples.push(`${regionId}: ${regionName}`);
      }
    }
  }

  console.log('\n3. SFR Matching results:');
  console.log('   Matched by ID:', matchedById);
  console.log('   Matched by name:', matchedByName);
  console.log('   No match:', noMatch);

  console.log('\n4. Sample unmatched metros:');
  unmatchedSamples.forEach(s => console.log('   -', s));

  // 5. Show sample crosswalk entries
  console.log('\n5. Sample crosswalk entries:');
  crosswalkData?.slice(0, 10).forEach(r => {
    console.log(`   ${r.zillow_region_id}: ${r.zillow_region_name} -> ${r.cbsa_code}`);
  });

  // 6. Check if region IDs in CSV are in crosswalk
  const csvRegionIds = new Set(sfrRows.map((r: any) => String(r['RegionID'])));
  const crosswalkRegionIds = new Set(crosswalkData?.map(r => String(r.zillow_region_id)));

  console.log('\n6. Region ID comparison:');
  console.log('   CSV unique region IDs:', csvRegionIds.size);
  console.log('   Crosswalk unique region IDs:', crosswalkRegionIds.size);

  // Show first few CSV region IDs
  console.log('\n   First 10 CSV region IDs:');
  Array.from(csvRegionIds).slice(0, 10).forEach(id => {
    const inCrosswalk = crosswalkRegionIds.has(id);
    console.log(`     ${id} - ${inCrosswalk ? 'IN CROSSWALK' : 'NOT IN CROSSWALK'}`);
  });
}

debug().catch(e => console.error('Error:', e));
