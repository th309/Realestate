import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function debug() {
  const { data } = await supabase
    .from('geography_crosswalk')
    .select('cbsa_code, cbsa_name')
    .not('cbsa_code', 'is', null)
    .limit(5);

  console.log('Sample CBSA codes with types:');
  data?.forEach(r => {
    console.log(`  cbsa_code: ${r.cbsa_code} (type: ${typeof r.cbsa_code}), name: ${r.cbsa_name}`);
  });

  // Check San Jose specifically
  const { data: sj } = await supabase
    .from('geography_crosswalk')
    .select('cbsa_code, cbsa_name')
    .eq('cbsa_name', 'San Jose-Sunnyvale-Santa Clara, CA')
    .limit(1);

  console.log('\nSan Jose lookup:');
  console.log('  cbsa_code:', sj?.[0]?.cbsa_code, 'type:', typeof sj?.[0]?.cbsa_code);
  console.log('  equals "41940":', sj?.[0]?.cbsa_code === '41940');
  console.log('  equals 41940:', sj?.[0]?.cbsa_code === 41940);
  console.log('  String match:', String(sj?.[0]?.cbsa_code) === '41940');
}

debug().catch(console.error);
