import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking Illinois ZIP data...\n');

  // IL state FIPS is 17
  const ilFips = '17';

  // Check tiger_zcta
  const { count: tigerCount } = await supabase
    .from('tiger_zcta')
    .select('*', { count: 'exact', head: true })
    .eq('default_state', 'IL');
  console.log('IL ZCTAs in tiger_zcta:', tigerCount);

  // Check census_zip with state_fips
  const { count: censusWithFips } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .eq('year', 2023)
    .eq('state_fips', ilFips);
  console.log('IL ZCTAs in census_zip (state_fips=17):', censusWithFips);

  // Check census_zip with state_name
  const { count: censusWithName } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .eq('year', 2023)
    .eq('state_name', 'Illinois');
  console.log('IL ZCTAs in census_zip (state_name=Illinois):', censusWithName);

  // Check if there are any IL ZCTAs at all (by ZCTA prefix 60xxx, 61xxx, 62xxx)
  const { data: ilPrefixSample } = await supabase
    .from('census_zip')
    .select('zcta, state_fips, state_name, total_population')
    .eq('year', 2023)
    .gte('zcta', '60000')
    .lte('zcta', '62999')
    .limit(10);
  console.log('\nSample IL-area ZCTAs (60xxx-62xxx):');
  console.log(ilPrefixSample);

  // Check what state_fips values exist
  const { data: stateFipsValues } = await supabase
    .from('census_zip')
    .select('state_fips')
    .eq('year', 2023)
    .limit(100);

  const uniqueFips = [...new Set(stateFipsValues?.map(r => r.state_fips))].sort();
  console.log('\nUnique state_fips values in census_zip (sample):', uniqueFips.slice(0, 20));

  // Check geography_crosswalk for IL ZCTAs
  const { count: crosswalkIL } = await supabase
    .from('geography_crosswalk')
    .select('*', { count: 'exact', head: true })
    .eq('state_code', 'IL');
  console.log('\nIL ZCTAs in geography_crosswalk:', crosswalkIL);

  // Sample from crosswalk
  const { data: crosswalkSample } = await supabase
    .from('geography_crosswalk')
    .select('zip_code, state_code, state_fips')
    .eq('state_code', 'IL')
    .limit(5);
  console.log('Sample IL crosswalk entries:', crosswalkSample);
}

check().catch(console.error);
