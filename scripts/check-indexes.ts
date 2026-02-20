import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })()
);

async function checkIndexes() {
  console.log('='.repeat(70));
  console.log('DATABASE PERFORMANCE ANALYSIS');
  console.log('='.repeat(70));

  // Check table sizes
  console.log('\n1. Table sizes...');

  const { count: zhviCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true });

  const { count: crosswalkCount } = await supabase
    .from('geography_crosswalk')
    .select('*', { count: 'exact', head: true });

  console.log(`   zillow_zhvi: ${zhviCount?.toLocaleString()} rows`);
  console.log(`   geography_crosswalk: ${crosswalkCount?.toLocaleString()} rows`);

  // Check existing indexes by querying pg_indexes
  console.log('\n2. Checking existing indexes...');
  const { data: indexes, error } = await supabase.rpc('get_table_indexes', {
    table_name: 'zillow_zhvi'
  });

  if (error) {
    console.log('   Could not query indexes directly (need RPC function)');
    console.log('   Checking query performance instead...');
  } else {
    console.log('   Indexes:', indexes);
  }

  // Time some typical queries
  console.log('\n3. Query performance tests...');

  // Test 1: State query (typical map load)
  const start1 = Date.now();
  await supabase
    .from('zillow_zhvi')
    .select('region_id, value')
    .eq('geography', 'State')
    .eq('property_type', 'sfrcondo')
    .eq('tier', '0.33_0.67')
    .order('date', { ascending: false })
    .limit(100);
  console.log(`   State query: ${Date.now() - start1}ms`);

  // Test 2: County query
  const start2 = Date.now();
  await supabase
    .from('zillow_zhvi')
    .select('region_id, value')
    .eq('geography', 'County')
    .eq('property_type', 'sfrcondo')
    .eq('tier', '0.33_0.67')
    .order('date', { ascending: false })
    .limit(2000);
  console.log(`   County query (2000 rows): ${Date.now() - start2}ms`);

  // Test 3: Metro query
  const start3 = Date.now();
  await supabase
    .from('zillow_zhvi')
    .select('region_id, value')
    .eq('geography', 'Metro')
    .eq('property_type', 'sfrcondo')
    .eq('tier', '0.33_0.67')
    .order('date', { ascending: false })
    .limit(500);
  console.log(`   Metro query (500 rows): ${Date.now() - start3}ms`);

  // Test 4: Latest date lookup
  const start4 = Date.now();
  await supabase
    .from('zillow_zhvi')
    .select('date')
    .eq('geography', 'State')
    .order('date', { ascending: false })
    .limit(1);
  console.log(`   Latest date lookup: ${Date.now() - start4}ms`);

  // Test 5: Crosswalk state lookup
  const start5 = Date.now();
  await supabase
    .from('geography_crosswalk')
    .select('state_abbrev, state_name, zillow_state_region_id')
    .eq('state_abbrev', 'CA')
    .limit(1);
  console.log(`   Crosswalk state lookup: ${Date.now() - start5}ms`);

  // Test 6: Crosswalk county FIPS lookup
  const start6 = Date.now();
  await supabase
    .from('geography_crosswalk')
    .select('county_fips, county_name')
    .not('county_fips', 'is', null)
    .limit(1000);
  console.log(`   Crosswalk county lookup (1000 rows): ${Date.now() - start6}ms`);

  console.log('\n' + '='.repeat(70));
  console.log('RECOMMENDED INDEXES');
  console.log('='.repeat(70));
  console.log(`
Based on the query patterns in the backend, these indexes would help:

zillow_zhvi table:
  1. CREATE INDEX idx_zhvi_geo_date_type_tier
     ON zillow_zhvi(geography, date DESC, property_type, tier);
     -- Covers: main map data queries (state, county, metro)

  2. CREATE INDEX idx_zhvi_geography_date
     ON zillow_zhvi(geography, date DESC);
     -- Covers: latest date lookups

  3. CREATE INDEX idx_zhvi_region_geography
     ON zillow_zhvi(region_id, geography);
     -- Covers: region_id IN (...) queries for counties

geography_crosswalk table:
  4. CREATE INDEX idx_crosswalk_state_abbrev
     ON geography_crosswalk(state_abbrev);
     -- Covers: state mapping lookups

  5. CREATE INDEX idx_crosswalk_county_fips
     ON geography_crosswalk(county_fips) WHERE county_fips IS NOT NULL;
     -- Covers: county FIPS lookups

  6. CREATE INDEX idx_crosswalk_cbsa_code
     ON geography_crosswalk(cbsa_code) WHERE cbsa_code IS NOT NULL;
     -- Covers: metro CBSA lookups

  7. CREATE INDEX idx_crosswalk_zillow_ids
     ON geography_crosswalk(zillow_state_region_id, zillow_metro_region_id, zillow_county_region_id);
     -- Covers: Zillow ID lookups
`);
}

checkIndexes().catch(console.error);
