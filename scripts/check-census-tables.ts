/**
 * Check Census tables for median income data
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Census median_household_income coverage:\n');

  // National
  const { count: natCount, error: natError } = await supabase
    .from('census_national')
    .select('*', { count: 'exact', head: true })
    .not('median_household_income', 'is', null);
  console.log(`national  : ${natCount || 0} records`, natError?.message || '');

  // State
  const { count: stateCount, error: stateError } = await supabase
    .from('census_state')
    .select('*', { count: 'exact', head: true })
    .not('median_household_income', 'is', null);
  console.log(`state     : ${stateCount || 0} records`, stateError?.message || '');

  // Metro
  const { count: metroCount, error: metroError } = await supabase
    .from('census_metro')
    .select('*', { count: 'exact', head: true })
    .not('median_household_income', 'is', null);
  console.log(`metro     : ${metroCount || 0} records`, metroError?.message || '');

  // County
  const { count: countyCount, error: countyError } = await supabase
    .from('census_county')
    .select('*', { count: 'exact', head: true })
    .not('median_household_income', 'is', null);
  console.log(`county    : ${countyCount || 0} records`, countyError?.message || '');

  // ZIP
  const { count: zipCount, error: zipError } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .not('median_household_income', 'is', null);
  console.log(`zip       : ${zipCount || 0} records`, zipError?.message || '');

  // Sample state data
  console.log('\nSample state median income (top 5):');
  const { data: stateData } = await supabase
    .from('census_state')
    .select('state_name, year, median_household_income')
    .not('median_household_income', 'is', null)
    .order('median_household_income', { ascending: false })
    .limit(5);

  for (const row of stateData || []) {
    console.log(`  ${row.state_name}: $${Number(row.median_household_income).toLocaleString()} (${row.year})`);
  }
}

check().catch(console.error);
