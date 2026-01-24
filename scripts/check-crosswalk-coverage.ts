#!/usr/bin/env npx tsx
/**
 * Check crosswalk coverage for zillow_metro region_ids
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkCoverage() {
  console.log('Checking crosswalk coverage...\n');

  // Get missing region_ids
  const { data: missingRows } = await supabase
    .from('zillow_metro')
    .select('region_id')
    .is('cbsa_code', null)
    .limit(100);

  const missingIds = [...new Set((missingRows || []).map(r => Number(r.region_id)))];
  console.log(`Missing CBSA codes for ${missingIds.length} region_ids`);
  console.log(`Sample missing IDs: ${missingIds.slice(0, 10).join(', ')}\n`);

  // Check crosswalk table
  const { data: crosswalkData, count: crosswalkCount } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, cbsa_code', { count: 'exact' })
    .limit(10);

  console.log(`Crosswalk table has ${crosswalkCount || 0} total entries`);
  if (crosswalkData && crosswalkData.length > 0) {
    console.log('Sample crosswalk entries:');
    crosswalkData.slice(0, 5).forEach(row => {
      console.log(`  region_id: ${row.zillow_region_id}, cbsa_code: ${row.cbsa_code}`);
    });
  }

  // Check if any missing IDs are in crosswalk
  if (missingIds.length > 0) {
    const { data: matches } = await supabase
      .from('zillow_metro_crosswalk')
      .select('zillow_region_id, cbsa_code')
      .in('zillow_region_id', missingIds.slice(0, 50));

    console.log(`\nFound ${matches?.length || 0} matches in crosswalk for missing IDs`);
    if (matches && matches.length > 0) {
      console.log('Matched entries:');
      matches.forEach(row => {
        console.log(`  region_id: ${row.zillow_region_id}, cbsa_code: ${row.cbsa_code}`);
      });
    }
  }
}

checkCoverage().catch(console.error);
