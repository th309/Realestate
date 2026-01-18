import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Checking ZORI SFR metro distribution...\n');

  // Check for metros starting with different letters
  const { data: bMetros } = await supabase
    .from('zillow_metro')
    .select('region_name')
    .eq('metric_name', 'zori_sfr')
    .ilike('region_name', 'B%')
    .limit(5);

  console.log('Metros starting with B:', bMetros?.length || 0);

  const { data: newMetros } = await supabase
    .from('zillow_metro')
    .select('region_name')
    .eq('metric_name', 'zori_sfr')
    .ilike('region_name', 'New%')
    .limit(5);

  console.log('Metros starting with New:', newMetros?.length || 0);

  // Check total distinct regions
  const { data: all } = await supabase
    .from('zillow_metro')
    .select('region_name, region_id')
    .eq('metric_name', 'zori_sfr')
    .limit(50000);

  const uniqueNames = new Set(all?.map(r => r.region_name));
  const uniqueIds = new Set(all?.map(r => r.region_id));

  console.log('\nTotal records fetched:', all?.length);
  console.log('Unique region names:', uniqueNames.size);
  console.log('Unique region IDs:', uniqueIds.size);

  // Show all unique names
  console.log('\nAll unique metros for zori_sfr:');
  Array.from(uniqueNames).sort().forEach(n => console.log(`  - ${n}`));

  // Now check original zori metric for comparison
  console.log('\n--- COMPARISON WITH ORIGINAL ZORI ---');
  const { data: origZori } = await supabase
    .from('zillow_metro')
    .select('region_name')
    .eq('metric_name', 'zori')
    .limit(50000);

  const origNames = new Set(origZori?.map(r => r.region_name));
  console.log('Original ZORI unique metros:', origNames.size);

  // Check if there's a mismatch
  console.log('\nSample of original ZORI metros:');
  Array.from(origNames).sort().slice(0, 20).forEach(n => console.log(`  - ${n}`));
}

check().then(() => console.log('\nDone')).catch(e => console.error('Error:', e));
