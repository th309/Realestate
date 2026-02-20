import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function inspect() {
  // Get one full row to see all columns
  const { data: sample } = await supabase
    .from('geography_crosswalk')
    .select('*')
    .limit(1);

  console.log('All columns in geography_crosswalk:');
  if (sample?.[0]) {
    Object.entries(sample[0]).forEach(([key, value]) => {
      console.log(`  ${key}: ${value} (${typeof value})`);
    });
  }

  // Check how many unique values for each county-related column
  console.log('\n--- Checking county-related columns ---\n');

  // county_fips
  const { data: fips } = await supabase
    .from('geography_crosswalk')
    .select('county_fips');
  const uniqueFips = [...new Set(fips?.map(r => r.county_fips).filter(Boolean))];
  console.log('county_fips unique values:', uniqueFips.length);

  // county_fips_3
  const { data: fips3 } = await supabase
    .from('geography_crosswalk')
    .select('county_fips_3');
  const uniqueFips3 = [...new Set(fips3?.map(r => r.county_fips_3).filter(Boolean))];
  console.log('county_fips_3 unique values:', uniqueFips3.length);

  // zillow_county_region_id
  const { data: zillowCounty } = await supabase
    .from('geography_crosswalk')
    .select('zillow_county_region_id');
  const uniqueZillowCounty = [...new Set(zillowCounty?.map(r => r.zillow_county_region_id).filter(Boolean))];
  console.log('zillow_county_region_id unique values:', uniqueZillowCounty.length);

  // Show some samples
  console.log('\nSample county_fips values:', uniqueFips.slice(0, 10));
  console.log('Sample zillow_county_region_id values:', uniqueZillowCounty.slice(0, 10));
}

inspect();
