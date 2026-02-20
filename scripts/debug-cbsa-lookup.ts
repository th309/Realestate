import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function debug() {
  // Check specific CBSA codes
  const testCBSAs = ['41940', '41860', '42200', '33860'];

  console.log('Looking up specific CBSA codes:\n');

  for (const cbsa of testCBSAs) {
    const { data } = await supabase
      .from('geography_crosswalk')
      .select('cbsa_code, cbsa_name, state_abbrev')
      .eq('cbsa_code', cbsa)
      .limit(1);

    console.log(`CBSA ${cbsa}:`, data?.[0]?.cbsa_name || 'NOT FOUND');
  }

  // Count unique CBSA codes in crosswalk
  const { data: allCBSA } = await supabase
    .from('geography_crosswalk')
    .select('cbsa_code')
    .not('cbsa_code', 'is', null);

  const uniqueCBSAs = new Set(allCBSA?.map(r => r.cbsa_code) || []);
  console.log('\nTotal unique CBSA codes in crosswalk:', uniqueCBSAs.size);

  // Count metros in zillow_zhvi
  const { count: metroCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'Metro')
    .eq('date', '2025-11-30');

  console.log('Total metro records in zillow_zhvi for 2025-11-30:', metroCount);

  // Check if first 10000 crosswalk rows contain 41940
  const { data: limited } = await supabase
    .from('geography_crosswalk')
    .select('cbsa_code')
    .not('cbsa_code', 'is', null)
    .limit(10000);

  const limitedCBSAs = new Set(limited?.map(r => r.cbsa_code) || []);
  console.log('Unique CBSA codes in first 10000 rows:', limitedCBSAs.size);
  console.log('Has 41940 in limited set?', limitedCBSAs.has('41940'));
}

debug().catch(console.error);
