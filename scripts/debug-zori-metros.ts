import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

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
