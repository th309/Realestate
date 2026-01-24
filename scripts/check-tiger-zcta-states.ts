import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking tiger_zcta state values...\n');

  // Get distinct states from tiger_zcta
  const { data: states } = await supabase
    .from('tiger_zcta')
    .select('default_state')
    .limit(100);

  const uniqueStates = [...new Set(states?.map(s => s.default_state))];
  console.log('Sample default_state values:', uniqueStates.slice(0, 20));

  // Check column structure
  const { data: sample } = await supabase
    .from('tiger_zcta')
    .select('*')
    .limit(1);

  if (sample && sample[0]) {
    console.log('\nColumns in tiger_zcta:', Object.keys(sample[0]).join(', '));
    console.log('\nSample row (excluding geometry):');
    const { geometry, ...rest } = sample[0];
    console.log(rest);
  }

  // Check CA specifically - try different formats
  console.log('\n=== Checking CA ZCTAs ===');

  const formats = ['CA', 'ca', 'California', 'california', '06'];
  for (const format of formats) {
    const { count } = await supabase
      .from('tiger_zcta')
      .select('*', { count: 'exact', head: true })
      .eq('default_state', format);
    console.log(`default_state = '${format}':`, count);
  }

  // Try ilike
  const { count: ilikeCount } = await supabase
    .from('tiger_zcta')
    .select('*', { count: 'exact', head: true })
    .ilike('default_state', '%CA%');
  console.log(`default_state ILIKE '%CA%':`, ilikeCount);

  // Check TN for comparison
  console.log('\n=== Checking TN ZCTAs ===');
  const tnFormats = ['TN', 'tn', 'Tennessee', '47'];
  for (const format of tnFormats) {
    const { count } = await supabase
      .from('tiger_zcta')
      .select('*', { count: 'exact', head: true })
      .eq('default_state', format);
    console.log(`default_state = '${format}':`, count);
  }

  // How many TN zips in census_zip?
  console.log('\n=== Census ZIP coverage comparison ===');

  // TN state FIPS is 47
  const { count: tnCensus } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .eq('year', 2023)
    .eq('state_fips', '47');
  console.log('TN ZCTAs in census_zip:', tnCensus);

  // CA state FIPS is 06
  const { count: caCensus } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .eq('year', 2023)
    .eq('state_fips', '06');
  console.log('CA ZCTAs in census_zip:', caCensus);

  // Total tiger counts
  const { count: tnTiger } = await supabase
    .from('tiger_zcta')
    .select('*', { count: 'exact', head: true })
    .eq('default_state', 'TN');
  console.log('\nTN ZCTAs in tiger_zcta:', tnTiger);

  const { count: caTiger } = await supabase
    .from('tiger_zcta')
    .select('*', { count: 'exact', head: true })
    .eq('default_state', 'CA');
  console.log('CA ZCTAs in tiger_zcta:', caTiger);
}

check().catch(console.error);
