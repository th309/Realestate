import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function test() {
  console.log('=== Testing Final Timeseries Queries ===\n');
  console.log('Testing with values that frontend will now send:\n');

  // Test COUNTY - with state
  console.log('--- COUNTY ---');
  const countyInput = 'Cook, IL'; // What frontend now sends
  const countyParts = countyInput.split(',').map(s => s.trim());
  const countyName = countyParts[0];
  const countyState = countyParts[1];

  // Realtor county
  const realtorPattern = `${countyName.toLowerCase()}, ${countyState.toLowerCase()}`;
  const { data: realtorCounty, count: realtorCountyCount } = await supabase
    .from('realtor_county')
    .select('county_name, county_fips, median_listing_price, period_date', { count: 'exact' })
    .ilike('county_name', `${realtorPattern}%`)
    .order('period_date', { ascending: false })
    .limit(3);

  console.log(`Input: "${countyInput}"`);
  console.log(`realtor_county ILIKE '${realtorPattern}%': ${realtorCountyCount} rows`);
  console.log('Match:', realtorCounty?.[0]?.county_name);

  // Census county
  const { data: censusCounty, count: censusCountyCount } = await supabase
    .from('census_county')
    .select('county_name, fips_code, total_population', { count: 'exact' })
    .ilike('county_name', `${countyName}%`)
    .eq('year', 2023)
    .limit(3);

  console.log(`census_county ILIKE '${countyName}%': ${censusCountyCount} rows`);
  console.log('Match:', censusCounty?.[0]?.county_name);

  // Test CITY - with state
  console.log('\n--- CITY ---');
  const cityInput = 'Miami, FL'; // What frontend now sends
  const cityParts = cityInput.split(',').map(s => s.trim());
  const cityName = cityParts[0];
  const stateCode = cityParts[1];

  // Zillow city
  const { data: zillowCity, count: zillowCityCount } = await supabase
    .from('zillow_city')
    .select('region_name, state_code, value, period_date', { count: 'exact' })
    .eq('region_name', cityName)
    .eq('state_code', stateCode)
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(3);

  console.log(`Input: "${cityInput}"`);
  console.log(`zillow_city region='${cityName}' state='${stateCode}': ${zillowCityCount} rows`);
  console.log('Match:', zillowCity?.[0] ? `${zillowCity[0].region_name}, ${zillowCity[0].state_code}` : 'none');
  console.log('Value:', zillowCity?.[0]?.value);

  // Census city
  const { data: censusCity, count: censusCityCount } = await supabase
    .from('census_city')
    .select('place_name, state_name, total_population', { count: 'exact' })
    .ilike('place_name', `${cityName}%`)
    .eq('year', 2023)
    .limit(3);

  console.log(`census_city ILIKE '${cityName}%': ${censusCityCount} rows`);
  console.log('Match:', censusCity?.[0]?.place_name);

  // Test ZIP
  console.log('\n--- ZIP ---');
  const zipInput = '33139';

  const { count: realtorZipCount } = await supabase
    .from('realtor_zip')
    .select('*', { count: 'exact', head: true })
    .eq('postal_code', zipInput);
  console.log(`realtor_zip postal_code='${zipInput}': ${realtorZipCount} rows`);

  const { count: zillowZipCount } = await supabase
    .from('zillow_zip')
    .select('*', { count: 'exact', head: true })
    .eq('region_name', zipInput)
    .eq('metric_name', 'zhvi');
  console.log(`zillow_zip region_name='${zipInput}': ${zillowZipCount} rows`);

  const { count: censusZipCount } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .eq('zcta', zipInput)
    .eq('year', 2023);
  console.log(`census_zip zcta='${zipInput}': ${censusZipCount} rows`);

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log('County (Cook, IL):');
  console.log(`  Realtor: ${realtorCountyCount && realtorCountyCount > 0 ? '✓ PASS' : '✗ FAIL'} (${realtorCountyCount} rows)`);
  console.log(`  Census: ${censusCountyCount && censusCountyCount > 0 ? '✓ PASS' : '✗ FAIL'} (${censusCountyCount} rows)`);
  console.log('City (Miami, FL):');
  console.log(`  Zillow: ${zillowCityCount && zillowCityCount > 0 ? '✓ PASS' : '✗ FAIL'} (${zillowCityCount} rows)`);
  console.log(`  Census: ${censusCityCount && censusCityCount > 0 ? '✓ PASS' : '✗ FAIL'} (${censusCityCount} rows)`);
  console.log('ZIP (33139):');
  console.log(`  Realtor: ${realtorZipCount && realtorZipCount > 0 ? '✓ PASS' : '✗ FAIL'} (${realtorZipCount} rows)`);
  console.log(`  Zillow: ${zillowZipCount && zillowZipCount > 0 ? '✓ PASS' : '✗ FAIL'} (${zillowZipCount} rows)`);
  console.log(`  Census: ${censusZipCount && censusZipCount > 0 ? '✓ PASS' : '✗ FAIL'} (${censusZipCount} rows)`);
}

test().catch(console.error);
