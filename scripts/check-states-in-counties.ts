import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log('Checking county data by state prefix...\n');

  // State FIPS prefixes
  const states = ['01', '02', '04', '05', '06', '08', '09', '10', '11', '12', '13'];
  const stateNames = {
    '01': 'Alabama',
    '02': 'Alaska',
    '04': 'Arizona',
    '05': 'Arkansas',
    '06': 'California',
    '08': 'Colorado',
    '09': 'Connecticut',
    '10': 'Delaware',
    '11': 'DC',
    '12': 'Florida',
    '13': 'Georgia',
  };

  for (const statePrefix of states) {
    const { count } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', 'County')
      .like('region_id', `${statePrefix}%`);

    console.log(`${stateNames[statePrefix] || statePrefix}: ${count || 0} records`);
  }
}

check();
