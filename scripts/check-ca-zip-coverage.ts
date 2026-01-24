import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Count California ZIPs in census_zip
  const { count: censusCA } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .eq('year', 2023)
    .eq('state_fips', '06');

  console.log('California ZIPs in census_zip:', censusCA);

  // Check total ZCTAs with population
  const { count: withPop } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .eq('year', 2023)
    .eq('state_fips', '06')
    .not('total_population', 'is', null);

  console.log('California ZIPs with population:', withPop);

  // Sample some CA ZIPs
  const { data: sample } = await supabase
    .from('census_zip')
    .select('zcta, total_population')
    .eq('year', 2023)
    .eq('state_fips', '06')
    .not('total_population', 'is', null)
    .order('zcta')
    .limit(10);

  console.log('\nSample CA ZIPs:', sample?.map(z => z.zcta));

  // Check LA area ZIPs (90xxx)
  const { data: laZips, count: laCount } = await supabase
    .from('census_zip')
    .select('zcta, total_population', { count: 'exact' })
    .eq('year', 2023)
    .eq('state_fips', '06')
    .gte('zcta', '90000')
    .lte('zcta', '90999');

  console.log('\nLA area ZIPs (90xxx):', laCount);
  console.log('Sample:', laZips?.slice(0, 5).map(z => z.zcta));

  // Check San Francisco area (94xxx)
  const { count: sfCount } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .eq('year', 2023)
    .eq('state_fips', '06')
    .gte('zcta', '94000')
    .lte('zcta', '94999');

  console.log('\nSF area ZIPs (94xxx):', sfCount);

  // Check how many CA ZIPs exist in the GeoJSON source (geography_zip table)
  const { count: geoJsonCA } = await supabase
    .from('geography_zip')
    .select('*', { count: 'exact', head: true })
    .eq('state_code', 'CA');

  console.log('\nCA ZIPs in geography_zip (GeoJSON source):', geoJsonCA);

  // Check realtor_zip for CA coverage
  const { count: realtorCA } = await supabase
    .from('realtor_zip')
    .select('*', { count: 'exact', head: true })
    .eq('state_id', 'CA');

  console.log('CA ZIPs in realtor_zip:', realtorCA);
}

check().catch(console.error);
