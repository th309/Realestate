/**
 * Check what geography levels exist in zillow_zhvi
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

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
