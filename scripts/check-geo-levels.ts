/**
 * Check what geography levels exist in zillow_zhvi
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkGeoLevels() {
  console.log('=== Checking Geography Levels in zillow_zhvi ===\n');

  // Get sample to see distinct geography values
  const { data: sample } = await supabase
    .from('zillow_zhvi')
    .select('geography')
    .limit(10000);

  if (sample) {
    const geos = [...new Set(sample.map(s => s.geography))];
    console.log('Distinct geography values found:', geos);
  }

  // Count records per geography type
  console.log('\n--- Record counts by geography ---');

  for (const geo of ['State', 'Metro', 'County', 'Zip', 'City', 'state', 'metro', 'county', 'zip', 'city', 'msa', 'MSA']) {
    const { count } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geo);

    if (count && count > 0) {
      console.log(`  ${geo}: ${count?.toLocaleString()} records`);
    }
  }

  // Check markets table for region mappings
  console.log('\n--- Markets table region_type counts ---');
  const { data: markets } = await supabase
    .from('markets')
    .select('region_type')
    .limit(10000);

  if (markets) {
    const types = [...new Set(markets.map(m => m.region_type))];
    console.log('Region types:', types);
  }

  // Sample metro data
  console.log('\n--- Sample Metro data ---');
  const { data: metros } = await supabase
    .from('markets')
    .select('region_id, region_name')
    .eq('region_type', 'msa')
    .limit(5);
  console.table(metros);

  // Sample county data
  console.log('\n--- Sample County data ---');
  const { data: counties } = await supabase
    .from('markets')
    .select('region_id, region_name')
    .eq('region_type', 'county')
    .limit(5);
  console.table(counties);

  // Sample zip data
  console.log('\n--- Sample Zip data ---');
  const { data: zips } = await supabase
    .from('markets')
    .select('region_id, region_name')
    .eq('region_type', 'zip')
    .limit(5);
  console.table(zips);
}

checkGeoLevels();
