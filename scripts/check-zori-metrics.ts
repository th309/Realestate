import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
  console.log('Checking metric counts in zillow_metro...\n');

  // Get samples from each major metric type
  const metrics = ['zori_sfr', 'zori_mfr', 'zori', 'zhvi', 'median_list_price', 'inventory'];

  for (const metric of metrics) {
    const { count, error } = await supabase
      .from('zillow_metro')
      .select('*', { count: 'exact', head: true })
      .eq('metric_name', metric);

    if (error) {
      console.log(`${metric}: Error - ${error.message}`);
    } else {
      console.log(`${metric}: ${count?.toLocaleString() || 0}`);
    }
  }

  // Get unique regions for zori_sfr (use limit to get all)
  console.log('\nUnique metros for zori_sfr:');
  const { data: sfrRegions, error: regErr } = await supabase
    .from('zillow_metro')
    .select('region_name, cbsa_code')
    .eq('metric_name', 'zori_sfr')
    .order('region_name')
    .limit(50000);

  if (regErr) {
    console.log('Error getting regions:', regErr.message);
  } else {
    const unique = new Map<string, string>();
    sfrRegions?.forEach(r => unique.set(r.region_name, r.cbsa_code));
    console.log(`Total unique metros for SFR: ${unique.size}`);
    // Show first 10 and last 10
    const metros = Array.from(unique.entries());
    console.log('First 10:');
    metros.slice(0, 10).forEach(([name, cbsa]) => console.log(`  - ${name} (${cbsa})`));
    console.log('Last 10:');
    metros.slice(-10).forEach(([name, cbsa]) => console.log(`  - ${name} (${cbsa})`));
  }

  // Get unique regions for zori_mfr
  console.log('\nUnique metros for zori_mfr:');
  const { data: mfrRegions, error: mfrErr } = await supabase
    .from('zillow_metro')
    .select('region_name, cbsa_code')
    .eq('metric_name', 'zori_mfr')
    .order('region_name')
    .limit(50000);

  if (mfrErr) {
    console.log('Error getting regions:', mfrErr.message);
  } else {
    const unique = new Map<string, string>();
    mfrRegions?.forEach(r => unique.set(r.region_name, r.cbsa_code));
    console.log(`Total unique metros for MFR: ${unique.size}`);
    // Show first 10 and last 10
    const metros = Array.from(unique.entries());
    console.log('First 10:');
    metros.slice(0, 10).forEach(([name, cbsa]) => console.log(`  - ${name} (${cbsa})`));
    console.log('Last 10:');
    metros.slice(-10).forEach(([name, cbsa]) => console.log(`  - ${name} (${cbsa})`));
  }
}

checkAll().then(() => console.log('\nDone')).catch(e => console.error('Fatal:', e));
