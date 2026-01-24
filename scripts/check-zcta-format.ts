import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Check ALL columns in census_zip
  const { data: allCols, error: colErr } = await supabase
    .from('census_zip')
    .select('*')
    .eq('year', 2023)
    .limit(1);

  if (allCols && allCols.length > 0) {
    console.log('census_zip ALL columns:', Object.keys(allCols[0]));
    console.log('Sample row:', JSON.stringify(allCols[0], null, 2));
  }

  // Check if state_fips exists and has values
  const { data: withState, error: stateErr } = await supabase
    .from('census_zip')
    .select('zcta, state_fips, total_population')
    .eq('year', 2023)
    .not('state_fips', 'is', null)
    .limit(5);

  console.log('\nRows with state_fips:', JSON.stringify(withState, null, 2));

  // Check FL ZIPs with state filter
  const { data: flData, error: flErr } = await supabase
    .from('census_zip')
    .select('zcta, state_fips, total_population')
    .eq('year', 2023)
    .eq('state_fips', '12')  // Florida FIPS
    .limit(5);

  console.log('\nFlorida ZIPs (state_fips=12):', JSON.stringify(flData, null, 2));
  if (flErr) console.log('FL query error:', flErr);
}

check().catch(console.error);
