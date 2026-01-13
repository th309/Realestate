/**
 * Check if we can map Zillow metro names to CBSA codes
 */

import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

async function checkMapping() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('Checking metro name mapping...\n');

  // 1. Get unique metros from zillow_metro
  const { data: zillowMetros } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name')
    .limit(50000);

  const uniqueZillowMetros = [...new Map(
    (zillowMetros || []).map(r => [r.region_id, r])
  ).values()];

  console.log(`Unique Zillow metros: ${uniqueZillowMetros.length}`);
  console.log('\nSample Zillow metro names:');
  uniqueZillowMetros.slice(0, 20).forEach(r =>
    console.log(`  ${r.region_id}: "${r.region_name}"`)
  );

  // 2. Get metros from geographies table
  const { data: geoMetros } = await supabase
    .from('geographies')
    .select('geography_id, name, cbsa_code, cbsa_name')
    .eq('geography_type', 'metro');

  console.log(`\nGeographies metros: ${geoMetros?.length || 0}`);
  if (geoMetros && geoMetros.length > 0) {
    console.log('\nSample geographies metro names:');
    geoMetros.slice(0, 20).forEach(r =>
      console.log(`  ${r.cbsa_code}: "${r.name}" (${r.cbsa_name})`)
    );
  }

  // 3. Try to match by name
  if (geoMetros && geoMetros.length > 0) {
    console.log('\nAttempting name matches...');
    let matches = 0;
    const geoNameMap = new Map(geoMetros.map(g => [g.name?.toLowerCase(), g]));
    const geoCbsaNameMap = new Map(geoMetros.map(g => [g.cbsa_name?.toLowerCase(), g]));

    for (const zm of uniqueZillowMetros.slice(0, 30)) {
      const nameLower = zm.region_name?.toLowerCase();
      const match = geoNameMap.get(nameLower) || geoCbsaNameMap.get(nameLower);
      if (match) {
        console.log(`  MATCH: "${zm.region_name}" -> ${match.cbsa_code}`);
        matches++;
      } else {
        console.log(`  NO MATCH: "${zm.region_name}"`);
      }
    }
    console.log(`\nMatched ${matches} out of ${Math.min(30, uniqueZillowMetros.length)}`);
  }

  // 4. Check what geography_types exist
  const { data: geoTypes } = await supabase
    .from('geographies')
    .select('geography_type')
    .limit(10000);

  const types = [...new Set(geoTypes?.map(g => g.geography_type) || [])];
  console.log(`\nGeography types in geographies table: ${types.join(', ') || 'NONE'}`);

  // 5. Count total rows in geographies
  const { count } = await supabase
    .from('geographies')
    .select('*', { count: 'exact', head: true });

  console.log(`Total rows in geographies table: ${count || 0}`);
}

checkMapping().catch(console.error);
