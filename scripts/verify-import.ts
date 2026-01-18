/**
 * Verify data import with YoY values
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function verify() {
  console.log('Verifying Data Import with YoY Values');
  console.log('='.repeat(60));

  // Check census state with YoY
  const { data: censusState } = await supabase
    .from('census_state')
    .select('year, state_name, total_population, population_yoy, median_household_income, income_yoy')
    .eq('state_fips', '06')
    .order('year', { ascending: false })
    .limit(5);

  console.log('\nCensus State (California):');
  console.table(censusState);

  // Check economic state with GDP YoY
  const { data: econState } = await supabase
    .from('economic_state')
    .select('period_date, state_name, unemployment_rate, gdp_millions, gdp_yoy, rpp_all_items')
    .eq('state_fips', '06')
    .not('gdp_millions', 'is', null)
    .order('period_date', { ascending: false })
    .limit(5);

  console.log('\nEconomic State (California - GDP years):');
  console.table(econState);

  // Check economic state with unemployment YoY
  const { data: econUnemploy } = await supabase
    .from('economic_state')
    .select('period_date, state_name, unemployment_rate, unemployment_rate_yoy')
    .eq('state_fips', '06')
    .not('unemployment_rate_yoy', 'is', null)
    .order('period_date', { ascending: false })
    .limit(5);

  console.log('\nEconomic State (California - Unemployment with YoY):');
  console.table(econUnemploy);

  // Summary counts
  console.log('\n' + '='.repeat(60));
  console.log('RECORD COUNTS');
  console.log('='.repeat(60));

  const tables = [
    'census_national', 'census_state', 'census_metro', 'census_county', 'census_city', 'census_zip',
    'economic_national', 'economic_state', 'economic_metro', 'economic_county'
  ];

  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`  ${table}: ${count?.toLocaleString()} records`);
  }
}

verify().catch(console.error);
