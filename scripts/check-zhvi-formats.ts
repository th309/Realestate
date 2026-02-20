import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log('=== Region ID formats in zillow_zhvi ===\n');

  const geographies = ['State', 'Metro', 'County', 'Zip', 'City'];

  for (const geo of geographies) {
    const { data, count } = await supabase
      .from('zillow_zhvi')
      .select('region_id', { count: 'exact' })
      .eq('geography', geo)
      .limit(10);

    console.log(`\n${geo}:`);
    console.log(`  Total records: ${count || 'N/A'}`);
    if (data && data.length > 0) {
      const ids = data.map(r => r.region_id);
      console.log(`  Sample IDs: ${ids.join(', ')}`);
    } else {
      console.log('  No records found');
    }
  }

  // Check what format the foreign key expects
  console.log('\n\n=== Checking markets table for matching regions ===');

  // Check if State region_ids match markets
  const { data: stateZhvi } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'State')
    .limit(3);

  if (stateZhvi) {
    console.log('\nState region_ids in zillow_zhvi:');
    for (const z of stateZhvi) {
      const { data: market } = await supabase
        .from('markets')
        .select('region_id, region_name')
        .eq('region_id', z.region_id)
        .limit(1);

      console.log(`  ${z.region_id}: ${market && market.length > 0 ? 'FOUND in markets' : 'NOT in markets'}`);
    }
  }

  // Check County format that works
  const { data: countyZhvi } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'County')
    .limit(3);

  if (countyZhvi) {
    console.log('\nCounty region_ids in zillow_zhvi:');
    for (const z of countyZhvi) {
      // Check as-is
      const { data: market1 } = await supabase
        .from('markets')
        .select('region_id, region_name')
        .eq('region_id', z.region_id)
        .limit(1);

      // Check with prefix
      const prefixedId = `US-COUNTY-${z.region_id}`;
      const { data: market2 } = await supabase
        .from('markets')
        .select('region_id, region_name')
        .eq('region_id', prefixedId)
        .limit(1);

      console.log(`  ${z.region_id}: direct=${market1?.length ? 'FOUND' : 'NO'}, prefixed=${market2?.length ? 'FOUND' : 'NO'}`);
    }
  }
}

check().catch(console.error);
