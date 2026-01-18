import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

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
