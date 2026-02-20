import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log('Checking county data...');

  // Simple query without count
  const { data, error } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'County')
    .order('region_id', { ascending: true })
    .limit(30);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Sample region_ids:', data?.map(d => d.region_id));

  // Check if any FIPS-formatted (5-digit, starts with 0)
  const fipsFormat = data?.filter(d => d.region_id.length === 5);
  console.log('5-digit IDs (FIPS format):', fipsFormat?.length, 'of', data?.length);
}

check();
