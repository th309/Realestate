import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkData() {
  // Check for any FIPS-formatted county records (5 digits starting with 0)
  const { data: fipsRecords, count: fipsCount } = await supabase
    .from('zillow_zhvi')
    .select('region_id, date', { count: 'exact' })
    .eq('geography', 'County')
    .like('region_id', '0%')
    .limit(10);

  console.log('FIPS-formatted county records:', fipsCount);
  console.log('Sample:', fipsRecords);

  // Check for old Zillow-formatted county records
  const { count: oldCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County')
    .not('region_id', 'like', '0%');

  console.log('\nOld Zillow format county records:', oldCount);
}

checkData();
