import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function investigate() {
  console.log('=== INVESTIGATING DATA FORMATS ===\n');

  // County - check realtor_county county_name format
  console.log('--- realtor_county ---');
  const { data: realtorCountySample } = await supabase
    .from('realtor_county')
    .select('county_fips, county_name, state_id')
    .ilike('county_name', '%Cook%')
    .limit(3);
  console.log('Cook county samples:', realtorCountySample);

  // Check what format of county_name exists
  const { data: countyFormats } = await supabase
    .from('realtor_county')
    .select('county_name')
    .limit(10);
  console.log('Sample county_name formats:', countyFormats?.map(c => c.county_name));

  // City - check zillow_city region_name format
  console.log('\n--- zillow_city ---');
  const { data: zillowCitySample } = await supabase
    .from('zillow_city')
    .select('region_name, state_code')
    .ilike('region_name', '%Miami%')
    .limit(5);
  console.log('Miami city samples:', zillowCitySample);

  // Check what format of region_name exists
  const { data: cityFormats } = await supabase
    .from('zillow_city')
    .select('region_name, state_code')
    .limit(10);
  console.log('Sample region_name formats:', cityFormats?.map(c => `${c.region_name}, ${c.state_code}`));

  // Census city - check place_name format
  console.log('\n--- census_city ---');
  const { data: censusCitySample } = await supabase
    .from('census_city')
    .select('place_name, state_name')
    .ilike('place_name', '%Miami%')
    .eq('year', 2023)
    .limit(5);
  console.log('Miami city samples:', censusCitySample);

  // ZIP - check realtor_zip columns
  console.log('\n--- realtor_zip ---');
  const { data: realtorZipSample } = await supabase
    .from('realtor_zip')
    .select('*')
    .limit(1);
  if (realtorZipSample?.[0]) {
    console.log('realtor_zip columns:', Object.keys(realtorZipSample[0]).filter(k => k !== 'geometry').slice(0, 20).join(', '));
    console.log('Sample:', {
      postal_code: realtorZipSample[0].postal_code,
      state_id: realtorZipSample[0].state_id,
    });
  }

  // Check total counts
  console.log('\n--- Row Counts ---');
  const { count: realtorCountyCount } = await supabase
    .from('realtor_county')
    .select('*', { count: 'exact', head: true });
  console.log('realtor_county rows:', realtorCountyCount);

  const { count: realtorZipCount } = await supabase
    .from('realtor_zip')
    .select('*', { count: 'exact', head: true });
  console.log('realtor_zip rows:', realtorZipCount);

  const { count: zillowCityCount } = await supabase
    .from('zillow_city')
    .select('*', { count: 'exact', head: true });
  console.log('zillow_city rows:', zillowCityCount);
}

investigate().catch(console.error);
