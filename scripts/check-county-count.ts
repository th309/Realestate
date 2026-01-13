import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log('Checking county data...');

  // First get exact count
  const { count, error: countError } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County');

  if (countError) {
    console.error('Count error:', countError);
  } else {
    console.log('Total county records:', count);
  }

  // Get records using range for pagination
  const { data, error } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'County')
    .order('region_id')
    .range(0, 4999);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Get unique region_ids
  const uniqueRegions = new Set(data?.map(d => d.region_id));
  console.log('Records returned:', data?.length);
  console.log('Unique region_ids:', uniqueRegions.size);

  // Sample some FIPS codes
  const fipsArray = Array.from(uniqueRegions).slice(0, 30);
  console.log('\nSample FIPS codes:', fipsArray);
}

check();
