import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log('Checking markets table for county FIPS...\n');

  // Check if any California county FIPS exist in markets
  const { data: calCounties, count: calCount } = await supabase
    .from('markets')
    .select('region_id', { count: 'exact' })
    .like('region_id', '06%')
    .limit(10);

  console.log('California counties in markets:', calCount);
  console.log('Sample:', calCounties?.map(d => d.region_id));

  // Check what's in markets table
  const { data: allMarkets, count: allCount } = await supabase
    .from('markets')
    .select('region_id', { count: 'exact' })
    .limit(20);

  console.log('\nTotal markets:', allCount);
  console.log('Sample market region_ids:', allMarkets?.map(d => d.region_id));
}

check();
