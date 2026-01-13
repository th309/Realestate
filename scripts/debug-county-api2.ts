import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function debug() {
  // 1. What dates exist for County?
  console.log('1. Available dates for County geography:');
  const { data: dates } = await supabase
    .from('zillow_zhvi')
    .select('date')
    .eq('geography', 'County')
    .order('date', { ascending: false })
    .limit(5);
  console.log(dates);

  // 2. CA FIPS codes in crosswalk
  console.log('\n2. CA FIPS codes in crosswalk:');
  const { data: caFips } = await supabase
    .from('geography_crosswalk')
    .select('county_fips')
    .eq('state_abbrev', 'CA')
    .not('county_fips', 'is', null)
    .limit(10);
  const uniqueCaFips = [...new Set(caFips?.map(r => r.county_fips))];
  console.log('Unique CA FIPS:', uniqueCaFips);

  // 3. Do any CA FIPS exist in zillow_zhvi?
  console.log('\n3. CA counties in zillow_zhvi:');
  const { data: caZhvi, count } = await supabase
    .from('zillow_zhvi')
    .select('region_id, date, value', { count: 'exact' })
    .eq('geography', 'County')
    .like('region_id', '06%')
    .limit(5);
  console.log('Count:', count);
  console.log(caZhvi);

  // 4. What state FIPS codes are in zillow_zhvi County?
  console.log('\n4. State prefixes in zillow_zhvi County:');
  const { data: allCounty } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'County')
    .limit(100);

  const statePrefixes = new Set(allCounty?.map(r => r.region_id.substring(0, 2)));
  console.log('State prefixes:', [...statePrefixes].sort());
}

debug();
