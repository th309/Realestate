import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
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
