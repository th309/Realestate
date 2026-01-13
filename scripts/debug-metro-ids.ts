import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function debug() {
  console.log('=== Debugging Metro IDs ===\n');

  // Get sample of metro IDs from zillow_zhvi
  const { data: zhviMetros } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'Metro')
    .eq('date', '2025-11-30')
    .limit(20);

  console.log('Sample region_ids from zillow_zhvi (Metro):');
  zhviMetros?.forEach(r => console.log('  ', r.region_id));

  // Get sample of metro mappings from crosswalk
  const { data: crosswalk } = await supabase
    .from('geography_crosswalk')
    .select('cbsa_code, cbsa_name, zillow_metro_region_id')
    .not('cbsa_code', 'is', null)
    .limit(20);

  console.log('\nSample from crosswalk:');
  crosswalk?.forEach(r => console.log(`  cbsa_code: ${r.cbsa_code}, zillow_metro_id: ${r.zillow_metro_region_id}, name: ${r.cbsa_name}`));

  // Check if any zhvi region_ids match crosswalk cbsa_code directly
  const zhviIds = zhviMetros?.map(r => r.region_id) || [];
  const { data: directMatch } = await supabase
    .from('geography_crosswalk')
    .select('cbsa_code, cbsa_name')
    .in('cbsa_code', zhviIds);

  console.log('\nDirect matches (zhvi region_id = crosswalk cbsa_code):');
  directMatch?.forEach(r => console.log(`  ${r.cbsa_code}: ${r.cbsa_name}`));
  console.log('  Count:', directMatch?.length || 0);

  // Check if any zhvi region_ids match zillow_metro_region_id
  const { data: zillowMatch } = await supabase
    .from('geography_crosswalk')
    .select('cbsa_code, cbsa_name, zillow_metro_region_id')
    .in('zillow_metro_region_id', zhviIds.map(Number));

  console.log('\nMatches via zillow_metro_region_id:');
  zillowMatch?.forEach(r => console.log(`  zillow_id ${r.zillow_metro_region_id} => cbsa ${r.cbsa_code}: ${r.cbsa_name}`));
  console.log('  Count:', zillowMatch?.length || 0);
}

debug().catch(console.error);
