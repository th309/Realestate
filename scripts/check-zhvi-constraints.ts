import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  // Try inserting a test record for LA County
  console.log('=== Testing insert for LA County (06037) ===\n');

  const testRecord = {
    region_id: '06037',
    date: '2025-01-15',  // Test date
    value: 850000,
    geography: 'County',
    property_type: 'sfrcondo',
    tier: '0.33_0.67',
  };

  console.log('Attempting to insert test record:', testRecord);

  const { data, error } = await supabase
    .from('zillow_zhvi')
    .insert([testRecord])
    .select();

  if (error) {
    console.log('\nINSERT FAILED:');
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    console.log('Error details:', error.details);
  } else {
    console.log('\nINSERT SUCCESS:');
    console.log('Inserted:', data);

    // Clean up test record
    await supabase
      .from('zillow_zhvi')
      .delete()
      .eq('region_id', '06037')
      .eq('date', '2025-01-15');
    console.log('(Test record cleaned up)');
  }

  // Check if markets table has the county
  console.log('\n=== Checking markets table for LA County ===');
  const { data: market } = await supabase
    .from('markets')
    .select('*')
    .eq('id', '06037')
    .limit(1);

  if (market && market.length > 0) {
    console.log('Found in markets:', market[0]);
  } else {
    console.log('06037 NOT FOUND in markets table');

    // Check if any CA counties exist in markets
    const { data: caMarkets } = await supabase
      .from('markets')
      .select('id, name')
      .like('id', '06%')
      .limit(10);

    console.log('\nCA entries in markets table:', caMarkets?.length || 0);
    if (caMarkets && caMarkets.length > 0) {
      caMarkets.forEach(m => console.log(`  ${m.id}: ${m.name}`));
    }
  }
}

check().catch(console.error);
