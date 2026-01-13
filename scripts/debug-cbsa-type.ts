import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
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
