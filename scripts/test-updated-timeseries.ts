import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function test() {
  console.log('=== Testing Updated Timeseries Queries ===\n');

  // Test COUNTY - Realtor (listing_price metric)
  console.log('--- COUNTY (Realtor) ---');
  const countyName = 'Cook'; // What frontend sends

  const { data: realtorCounty, count: realtorCountyCount } = await supabase
    .from('realtor_county')
    .select('county_name, county_fips, median_listing_price, period_date', { count: 'exact' })
    .ilike('county_name', `${countyName.toLowerCase()}%`)
    .order('period_date', { ascending: false })
    .limit(3);

  console.log(`realtor_county ILIKE '${countyName.toLowerCase()}%': ${realtorCountyCount} rows`);
  console.log('Sample:', realtorCounty?.[0]);

  // Test COUNTY - Census (population metric)
  console.log('\n--- COUNTY (Census) ---');
  const { data: censusCounty, count: censusCountyCount } = await supabase
    .from('census_county')
    .select('county_name, fips_code, total_population', { count: 'exact' })
    .ilike('county_name', `${countyName}%`)
    .eq('year', 2023)
    .limit(3);

  console.log(`census_county ILIKE '${countyName}%': ${censusCountyCount} rows`);
  console.log('Sample:', censusCounty?.[0]);

  // Test CITY - Zillow (home_value metric)
  console.log('\n--- CITY (Zillow) ---');
  const cityName = 'Miami'; // What frontend sends

  const { data: zillowCity, count: zillowCityCount } = await supabase
    .from('zillow_city')
    .select('region_name, state_code, value, period_date', { count: 'exact' })
    .eq('region_name', cityName)
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(3);

  console.log(`zillow_city region_name = '${cityName}': ${zillowCityCount} rows`);
  console.log('Sample:', zillowCity?.[0]);

  // Test CITY - Census (population metric)
  console.log('\n--- CITY (Census) ---');
  const { data: censusCity, count: censusCityCount } = await supabase
    .from('census_city')
    .select('place_name, state_name, total_population', { count: 'exact' })
    .ilike('place_name', `${cityName}%`)
    .eq('year', 2023)
    .limit(3);

  console.log(`census_city ILIKE '${cityName}%': ${censusCityCount} rows`);
  console.log('Sample:', censusCity?.[0]);

  // Test ZIP - Realtor (listing_price metric)
  console.log('\n--- ZIP (Realtor) ---');
  const zipCode = '33139'; // What frontend sends

  const { data: realtorZip, count: realtorZipCount } = await supabase
    .from('realtor_zip')
    .select('postal_code, zip_name, median_listing_price, period_date', { count: 'exact' })
    .eq('postal_code', zipCode)
    .order('period_date', { ascending: false })
    .limit(3);

  console.log(`realtor_zip postal_code = '${zipCode}': ${realtorZipCount} rows`);
  console.log('Sample:', realtorZip?.[0]);

  // Test ZIP - Zillow (home_value metric)
  console.log('\n--- ZIP (Zillow) ---');
  const { data: zillowZip, count: zillowZipCount } = await supabase
    .from('zillow_zip')
    .select('region_name, value, period_date', { count: 'exact' })
    .eq('region_name', zipCode)
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(3);

  console.log(`zillow_zip region_name = '${zipCode}': ${zillowZipCount} rows`);
  console.log('Sample:', zillowZip?.[0]);

  // Test ZIP - Census (population metric)
  console.log('\n--- ZIP (Census) ---');
  const { data: censusZip, count: censusZipCount } = await supabase
    .from('census_zip')
    .select('zcta, total_population', { count: 'exact' })
    .eq('zcta', zipCode)
    .eq('year', 2023)
    .limit(3);

  console.log(`census_zip zcta = '${zipCode}': ${censusZipCount} rows`);
  console.log('Sample:', censusZip?.[0]);

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log('County (Cook):');
  console.log(`  ✓ Realtor: ${realtorCountyCount ? 'PASS' : 'FAIL'} (${realtorCountyCount} rows)`);
  console.log(`  ✓ Census: ${censusCountyCount ? 'PASS' : 'FAIL'} (${censusCountyCount} rows)`);
  console.log('City (Miami):');
  console.log(`  ✓ Zillow: ${zillowCityCount ? 'PASS' : 'FAIL'} (${zillowCityCount} rows)`);
  console.log(`  ✓ Census: ${censusCityCount ? 'PASS' : 'FAIL'} (${censusCityCount} rows)`);
  console.log('ZIP (33139):');
  console.log(`  ✓ Realtor: ${realtorZipCount ? 'PASS' : 'FAIL'} (${realtorZipCount} rows)`);
  console.log(`  ✓ Zillow: ${zillowZipCount ? 'PASS' : 'FAIL'} (${zillowZipCount} rows)`);
  console.log(`  ✓ Census: ${censusZipCount ? 'PASS' : 'FAIL'} (${censusZipCount} rows)`);
}

test().catch(console.error);
