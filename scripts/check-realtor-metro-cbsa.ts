import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCbsa() {
  console.log('Testing query with cbsa_title (correct column name)...\n');

  // Query with correct column name
  const { data, error } = await supabase
    .from('realtor_metro')
    .select('cbsa_code, cbsa_title, median_listing_price, period_date')
    .eq('period_date', '2025-12-01')
    .not('median_listing_price', 'is', null)
    .limit(3);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Records with cbsa_title:');
  data?.forEach(r => {
    console.log(`  cbsa: ${r.cbsa_code}, title: ${r.cbsa_title}, price: ${r.median_listing_price}`);
  });

  // Test with metro_name to show it fails
  console.log('\nTesting query with metro_name (wrong column name)...');
  const { data: badData, error: badError } = await supabase
    .from('realtor_metro')
    .select('cbsa_code, metro_name, median_listing_price')
    .limit(1);

  if (badError) {
    console.log('Error (expected):', badError.message);
  } else {
    console.log('Data:', badData);
  }
}

checkCbsa().catch(console.error);
