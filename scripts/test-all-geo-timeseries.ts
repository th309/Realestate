import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testCounty() {
  console.log('=== COUNTY TESTS ===\n');

  // From useGraphSearch.ts line 485: value: county.name (e.g., "Cook")
  // Backend uses county_fips for realtor, fips_code for others

  // Check what columns exist in realtor_county
  const { data: realtorSample } = await supabase
    .from('realtor_county')
    .select('*')
    .limit(1);

  if (realtorSample?.[0]) {
    console.log('realtor_county columns:', Object.keys(realtorSample[0]).filter(k => k !== 'geometry').join(', '));
  }

  // Test searching for "Cook" (Cook County, IL)
  const testCountyName = 'Cook';

  // Current approach: uses county_fips
  const { count: byFips } = await supabase
    .from('realtor_county')
    .select('*', { count: 'exact', head: true })
    .eq('county_fips', testCountyName);
  console.log(`realtor_county.county_fips = '${testCountyName}': ${byFips} rows`);

  // Check if there's a county_name column
  const { data: byName, count: nameCount } = await supabase
    .from('realtor_county')
    .select('county_fips, county_name, state_id, median_listing_price', { count: 'exact' })
    .ilike('county_name', `${testCountyName}%`)
    .limit(5);
  console.log(`realtor_county.county_name ILIKE '${testCountyName}%': ${nameCount} rows`);
  console.log('Matches:', byName?.map(r => `${r.county_name}, ${r.state_id}`).slice(0, 3));

  // Check census_county
  const { data: censusSample } = await supabase
    .from('census_county')
    .select('*')
    .limit(1);

  if (censusSample?.[0]) {
    console.log('\ncensus_county columns:', Object.keys(censusSample[0]).join(', '));
  }

  const { data: censusByName, count: censusCount } = await supabase
    .from('census_county')
    .select('fips_code, county_name, state_name, total_population', { count: 'exact' })
    .ilike('county_name', `${testCountyName}%`)
    .eq('year', 2023)
    .limit(5);
  console.log(`census_county.county_name ILIKE '${testCountyName}%': ${censusCount} rows`);
  console.log('Matches:', censusByName?.map(r => `${r.county_name}, ${r.state_name}`).slice(0, 3));
}

async function testCity() {
  console.log('\n=== CITY TESTS ===\n');

  // From useGraphSearch.ts line 566: value: city.name (e.g., "Miami")
  // Backend uses region_name for Zillow, place_name for Census

  // Check zillow_city
  const { data: zillowSample } = await supabase
    .from('zillow_city')
    .select('*')
    .limit(1);

  if (zillowSample?.[0]) {
    console.log('zillow_city columns:', Object.keys(zillowSample[0]).join(', '));
  }

  const testCityName = 'Miami';

  // Test zillow_city with region_name
  const { data: zillowByName, count: zillowCount } = await supabase
    .from('zillow_city')
    .select('region_id, region_name, state_code, value, period_date', { count: 'exact' })
    .eq('region_name', testCityName)
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(3);
  console.log(`zillow_city.region_name = '${testCityName}' (zhvi): ${zillowCount} rows`);
  console.log('Sample:', zillowByName?.[0]);

  // Check census_city
  const { data: censusSample } = await supabase
    .from('census_city')
    .select('*')
    .limit(1);

  if (censusSample?.[0]) {
    console.log('\ncensus_city columns:', Object.keys(censusSample[0]).join(', '));
  }

  const { data: censusByName, count: censusCount } = await supabase
    .from('census_city')
    .select('place_fips, place_name, state_name, total_population', { count: 'exact' })
    .eq('place_name', testCityName)
    .eq('year', 2023)
    .limit(5);
  console.log(`census_city.place_name = '${testCityName}': ${censusCount} rows`);
  console.log('Matches:', censusByName?.map(r => `${r.place_name}, ${r.state_name}`));
}

async function testZip() {
  console.log('\n=== ZIP TESTS ===\n');

  // From useGraphSearch.ts line 526: value: zip.code (e.g., "33139")
  // Backend uses postal_code for realtor, region_name for zillow, zcta for census

  const testZip = '33139'; // Miami Beach

  // Test realtor_zip
  const { data: realtorByCode, count: realtorCount } = await supabase
    .from('realtor_zip')
    .select('postal_code, state_id, median_listing_price, period_date', { count: 'exact' })
    .eq('postal_code', testZip)
    .order('period_date', { ascending: false })
    .limit(3);
  console.log(`realtor_zip.postal_code = '${testZip}': ${realtorCount} rows`);
  console.log('Sample:', realtorByCode?.[0]);

  // Test zillow_zip
  const { data: zillowByName, count: zillowCount } = await supabase
    .from('zillow_zip')
    .select('region_id, region_name, value, period_date', { count: 'exact' })
    .eq('region_name', testZip)
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(3);
  console.log(`zillow_zip.region_name = '${testZip}' (zhvi): ${zillowCount} rows`);
  console.log('Sample:', zillowByName?.[0]);

  // Test census_zip
  const { data: censusByZcta, count: censusCount } = await supabase
    .from('census_zip')
    .select('zcta, state_fips, total_population', { count: 'exact' })
    .eq('zcta', testZip)
    .eq('year', 2023)
    .limit(3);
  console.log(`census_zip.zcta = '${testZip}': ${censusCount} rows`);
  console.log('Sample:', censusByZcta?.[0]);
}

async function main() {
  await testCounty();
  await testCity();
  await testZip();
}

main().catch(console.error);
