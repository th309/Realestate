/**
 * Populate CBSA codes in zillow_metro table using the crosswalk CSV
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { parse as parseSync } from 'csv-parse/sync';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

async function populateCbsaCodes() {
  console.log('='.repeat(60));
  console.log('POPULATE CBSA CODES IN ZILLOW_METRO');
  console.log('='.repeat(60));

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1. Read crosswalk CSV
  console.log('\nReading crosswalk CSV...');
  const csvPath = join(__dirname, '../unified_geography_crosswalk.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  const records: any[] = parseSync(csvContent, { columns: true, skip_empty_lines: true });

  console.log(`Total crosswalk records: ${records.length}`);

  // 2. Build unique mapping: zillow_metro_region_id -> cbsa_code
  const metroToCbsa = new Map<number, string>();

  for (const record of records) {
    const zillowMetroId = parseInt(record.zillow_metro_region_id, 10);
    const cbsaCode = record.cbsa_code;

    if (!isNaN(zillowMetroId) && cbsaCode && cbsaCode.trim()) {
      metroToCbsa.set(zillowMetroId, cbsaCode.trim());
    }
  }

  console.log(`Unique Zillow metro -> CBSA mappings: ${metroToCbsa.size}`);

  // Show sample mappings
  console.log('\nSample mappings:');
  let count = 0;
  for (const [zillowId, cbsa] of metroToCbsa) {
    if (count++ < 10) {
      console.log(`  ${zillowId} -> ${cbsa}`);
    }
  }

  // 3. Get unique region_ids from zillow_metro that need CBSA codes
  console.log('\nChecking zillow_metro for unique region_ids...');
  const { data: metros } = await supabase
    .from('zillow_metro')
    .select('region_id')
    .is('cbsa_code', null)
    .limit(100000);

  const uniqueRegionIds = [...new Set(metros?.map(m => m.region_id) || [])];
  console.log(`Unique region_ids with NULL cbsa_code: ${uniqueRegionIds.length}`);

  // 4. Find matches
  const updates: { region_id: number; cbsa_code: string }[] = [];
  let noMatch = 0;

  for (const regionId of uniqueRegionIds) {
    const cbsaCode = metroToCbsa.get(regionId);
    if (cbsaCode) {
      updates.push({ region_id: regionId, cbsa_code: cbsaCode });
    } else {
      noMatch++;
    }
  }

  console.log(`\nMatches found: ${updates.length}`);
  console.log(`No match found: ${noMatch}`);

  if (updates.length === 0) {
    console.log('\nNo updates to make.');
    return;
  }

  // 5. Update zillow_metro table
  console.log('\nUpdating zillow_metro table...');

  let totalUpdated = 0;
  for (const update of updates) {
    const { error, count: updateCount } = await supabase
      .from('zillow_metro')
      .update({ cbsa_code: update.cbsa_code })
      .eq('region_id', update.region_id)
      .is('cbsa_code', null);

    if (error) {
      console.error(`Error updating region_id ${update.region_id}: ${error.message}`);
    } else {
      totalUpdated++;
      console.log(`  Updated region_id ${update.region_id} -> ${update.cbsa_code}`);
    }
  }

  console.log(`\nTotal region_ids updated: ${totalUpdated}`);

  // 6. Verify
  const { count: remainingNull } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .is('cbsa_code', null);

  const { count: withCbsa } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .not('cbsa_code', 'is', null);

  console.log('\n--- VERIFICATION ---');
  console.log(`Rows with cbsa_code: ${withCbsa || 0}`);
  console.log(`Rows still NULL: ${remainingNull || 0}`);

  console.log('\n' + '='.repeat(60));
  console.log('DONE');
  console.log('='.repeat(60));
}

populateCbsaCodes().catch(console.error);
