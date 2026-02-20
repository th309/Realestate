import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  // Simple query - just sample County records
  console.log('=== Sample County records from zillow_zhvi ===\n');

  const { data: sample } = await supabase
    .from('zillow_zhvi')
    .select('region_id, geography, date, value')
    .eq('geography', 'County')
    .order('region_id')
    .limit(20);

  console.log('First 20 County records:');
  sample?.forEach(r => {
    console.log(`  ${r.region_id} | ${r.date} | $${r.value?.toLocaleString()}`);
  });

  // What does region_id look like?
  console.log('\n=== Region ID format analysis ===');
  const { data: regionIds } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'County')
    .limit(500);

  const ids = regionIds?.map(r => r.region_id) || [];
  const unique = [...new Set(ids)];

  console.log('Sample unique region_ids (first 500 records):', unique.length);
  console.log('First 30 IDs:', unique.slice(0, 30).sort());

  // Check format
  const fips5 = unique.filter(id => /^\d{5}$/.test(id));
  const numeric = unique.filter(id => /^\d+$/.test(id) && !/^\d{5}$/.test(id));
  const other = unique.filter(id => !/^\d+$/.test(id));

  console.log('\nFormat breakdown:');
  console.log('  5-digit (FIPS):', fips5.length);
  console.log('  Other numeric:', numeric.length);
  console.log('  Non-numeric:', other.length);

  if (numeric.length > 0) {
    console.log('\nOther numeric IDs (possible Zillow IDs):', numeric.slice(0, 20));
  }
}

check().catch(console.error);
