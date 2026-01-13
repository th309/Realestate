import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  // Get ALL unique CA FIPS from crosswalk (no limit)
  const { data, error } = await supabase
    .from('geography_crosswalk')
    .select('county_fips')
    .eq('state_abbrev', 'CA')
    .not('county_fips', 'is', null);

  if (error) {
    console.log('Error:', error);
    return;
  }

  const unique = [...new Set(data?.map(r => r.county_fips))];
  console.log('Total unique CA FIPS in crosswalk:', unique.length);
  console.log('Sample:', unique.slice(0, 20));

  // Check if 06049 is in there
  console.log('\nHas 06049 (Modoc):', unique.includes('06049'));

  // Also check what CA counties exist in zillow_zhvi
  const { data: zhvi } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'County')
    .like('region_id', '06%');

  const zhviUnique = [...new Set(zhvi?.map(r => r.region_id))];
  console.log('\nTotal unique CA FIPS in zillow_zhvi:', zhviUnique.length);
  console.log('Sample:', zhviUnique.slice(0, 20));

  // Check intersection
  const inBoth = zhviUnique.filter(f => unique.includes(f));
  console.log('\nFIPS in BOTH tables:', inBoth.length);
  console.log('Sample intersection:', inBoth.slice(0, 10));
}

check();
