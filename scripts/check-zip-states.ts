import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I'
);

async function checkStates() {
  // Sample some records to see what state_code values look like
  const { data: sample } = await supabase
    .from('zillow_zip')
    .select('region_name, state_code')
    .limit(20);

  console.log('Sample records:');
  sample?.forEach(r => console.log(`  ZIP ${r.region_name} -> ${r.state_code || 'NULL'}`));

  // Get count of NULL state_codes
  const { count: nullCount } = await supabase
    .from('zillow_zip')
    .select('*', { count: 'exact', head: true })
    .is('state_code', null);

  console.log(`\nRecords with NULL state_code: ${nullCount}`);

  // Sample some records with null state_code
  const { data: nullSample } = await supabase
    .from('zillow_zip')
    .select('region_name')
    .is('state_code', null)
    .limit(10);

  console.log('\nSample ZIPs with NULL state_code:');
  nullSample?.forEach(r => console.log(`  ${r.region_name}`));
}

checkStates().catch(console.error);
