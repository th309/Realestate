import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  // Run an RPC call or use a SQL function if available

  // Let's check what tables exist
  console.log('--- Tables with county data ---');

  // 1. zillow_zhvi county count
  const { count: zhviCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County');
  console.log('zillow_zhvi County records (total):', zhviCount);

  // 2. geography_crosswalk unique county_fips
  const { count: crosswalkTotal } = await supabase
    .from('geography_crosswalk')
    .select('*', { count: 'exact', head: true });
  console.log('geography_crosswalk total rows:', crosswalkTotal);

  // 3. Check specifically for CA in zillow_zhvi
  console.log('\n--- CA specific queries ---');

  const { count: zhviCaCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County')
    .like('region_id', '06%');
  console.log('zillow_zhvi CA County records:', zhviCaCount);

  // 4. Sample CA counties
  const { data: caSample } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date')
    .eq('geography', 'County')
    .like('region_id', '06%')
    .order('region_id')
    .limit(100);

  if (caSample && caSample.length > 0) {
    const uniqueCa = [...new Set(caSample.map(r => r.region_id))];
    console.log('CA counties in sample (first 100 records):', uniqueCa.length);
    console.log('CA FIPS codes found:', uniqueCa.sort());
  }

  // 5. Check if major CA counties exist
  console.log('\n--- Checking major CA counties ---');
  const majorCaCounties = ['06037', '06073', '06059', '06065', '06071', '06085', '06001', '06067'];

  for (const fips of majorCaCounties) {
    const { count } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', 'County')
      .eq('region_id', fips);
    console.log(`  ${fips}: ${count || 0} records`);
  }

  // 6. Check date range
  console.log('\n--- Date range for County data ---');
  const { data: dateRange } = await supabase
    .from('zillow_zhvi')
    .select('date')
    .eq('geography', 'County')
    .order('date', { ascending: true })
    .limit(1);
  console.log('Earliest date:', dateRange?.[0]?.date);

  const { data: latestDate } = await supabase
    .from('zillow_zhvi')
    .select('date')
    .eq('geography', 'County')
    .order('date', { ascending: false })
    .limit(1);
  console.log('Latest date:', latestDate?.[0]?.date);
}

check().catch(console.error);
