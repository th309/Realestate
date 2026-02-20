import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log('=== Markets table analysis ===\n');

  // Total count
  const { count: total } = await supabase
    .from('markets')
    .select('*', { count: 'exact', head: true });
  console.log('Total markets:', total);

  // Sample records
  const { data: sample } = await supabase
    .from('markets')
    .select('*')
    .limit(10);

  console.log('\nSample records:');
  sample?.forEach(m => {
    console.log(`  ${m.id} | ${m.name} | ${m.type}`);
  });

  // Check structure
  if (sample?.[0]) {
    console.log('\nColumns:', Object.keys(sample[0]));
  }

  // Check CA entries
  console.log('\n--- CA entries in markets ---');
  const { data: caMarkets, count: caCount } = await supabase
    .from('markets')
    .select('id, name, type', { count: 'exact' })
    .like('id', '06%')
    .limit(20);

  console.log('CA markets count:', caCount);
  if (caMarkets && caMarkets.length > 0) {
    console.log('CA markets:');
    caMarkets.forEach(m => console.log(`  ${m.id}: ${m.name} (${m.type})`));
  }

  // Check what types exist
  const { data: types } = await supabase
    .from('markets')
    .select('type')
    .limit(1000);

  const uniqueTypes = [...new Set(types?.map(t => t.type) || [])];
  console.log('\nUnique market types:', uniqueTypes);

  // Check if LA County exists
  console.log('\n--- Checking specific counties ---');
  const counties = ['06037', '06073', '06059', '06001', '06067'];
  for (const fips of counties) {
    const { data } = await supabase
      .from('markets')
      .select('*')
      .eq('id', fips)
      .limit(1);

    console.log(`${fips}: ${data && data.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);
  }
}

check().catch(console.error);
