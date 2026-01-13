/**
 * Check CBSA code mapping between geographies and zillow_metro tables
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

  console.log('Checking CBSA code mapping...\n');

  // 1. Check zillow_metro for NULL cbsa_codes
  const { data: nullCbsa, count: nullCount } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name', { count: 'exact' })
    .is('cbsa_code', null)
    .limit(20);

  console.log(`zillow_metro rows with NULL cbsa_code: ${nullCount || 0}`);
  if (nullCbsa && nullCbsa.length > 0) {
    console.log('Sample metros with NULL cbsa_code:');
    const unique = [...new Map(nullCbsa.map(r => [r.region_id, r])).values()];
    unique.slice(0, 10).forEach(r => console.log(`  - ${r.region_id}: ${r.region_name}`));
  }

  // 2. Check geographies table for metro mappings
  const { data: geoMetros, count: geoMetroCount } = await supabase
    .from('geographies')
    .select('zillow_metro_region_id, cbsa_code, name', { count: 'exact' })
    .eq('geography_type', 'metro')
    .not('zillow_metro_region_id', 'is', null)
    .limit(20);

  console.log(`\ngeographies table - metros with zillow_metro_region_id: ${geoMetroCount || 0}`);
  if (geoMetros && geoMetros.length > 0) {
    console.log('Sample metro mappings in geographies:');
    geoMetros.slice(0, 10).forEach(r =>
      console.log(`  - ${r.zillow_metro_region_id} -> ${r.cbsa_code}: ${r.name}`)
    );
  }

  // 3. Check if we can match the NULL cbsa metros
  if (nullCbsa && nullCbsa.length > 0) {
    const regionIds = [...new Set(nullCbsa.map(r => r.region_id))];

    const { data: matches } = await supabase
      .from('geographies')
      .select('zillow_metro_region_id, cbsa_code, name')
      .in('zillow_metro_region_id', regionIds);

    console.log(`\nMatches found in geographies for NULL cbsa metros: ${matches?.length || 0}`);
    if (matches && matches.length > 0) {
      matches.slice(0, 10).forEach(r =>
        console.log(`  - ${r.zillow_metro_region_id} -> ${r.cbsa_code}: ${r.name}`)
      );
    }
  }

  // 4. Check total unique metros in zillow_metro
  const { data: uniqueMetros } = await supabase
    .from('zillow_metro')
    .select('region_id')
    .limit(100000);

  const uniqueRegionIds = new Set(uniqueMetros?.map(r => r.region_id) || []);
  console.log(`\nUnique region_ids in zillow_metro: ${uniqueRegionIds.size}`);

  // 5. Check sample of raw data to see what CBSACode looks like
  const { data: sampleWithCbsa } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, cbsa_code')
    .not('cbsa_code', 'is', null)
    .limit(10);

  console.log('\nSample metros WITH cbsa_code:');
  sampleWithCbsa?.forEach(r =>
    console.log(`  - ${r.region_id} (${r.cbsa_code}): ${r.region_name}`)
  );
}

checkMapping().catch(console.error);
