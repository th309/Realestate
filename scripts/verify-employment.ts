/**
 * Verify employment data in database
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function verify() {
  console.log('Verifying Employment Data (Job Growth)');
  console.log('='.repeat(60));

  // National employment
  const { data: national } = await supabase
    .from('economic_national')
    .select('period_date, unemployment_rate, total_nonfarm_employment, employment_yoy')
    .not('employment_yoy', 'is', null)
    .order('period_date', { ascending: false })
    .limit(5);

  console.log('\nNational Employment (with YoY):');
  console.table(national);

  // State employment (California)
  const { data: state } = await supabase
    .from('economic_state')
    .select('period_date, state_name, total_nonfarm_employment, employment_yoy')
    .eq('state_fips', '06')
    .not('employment_yoy', 'is', null)
    .order('period_date', { ascending: false })
    .limit(5);

  console.log('\nState Employment (California - with YoY):');
  console.table(state);

  // Metro employment (major metros)
  const { data: metro } = await supabase
    .from('economic_metro')
    .select('period_date, cbsa_code, cbsa_title, total_nonfarm_employment, employment_yoy')
    .not('employment_yoy', 'is', null)
    .order('period_date', { ascending: false })
    .limit(10);

  console.log('\nMetro Employment (with YoY):');
  console.table(metro);

  // Count records with employment data
  console.log('\n' + '='.repeat(60));
  console.log('EMPLOYMENT DATA COUNTS');
  console.log('='.repeat(60));

  const { count: natCount } = await supabase
    .from('economic_national')
    .select('*', { count: 'exact', head: true })
    .not('employment_yoy', 'is', null);
  console.log(`  National with employment_yoy: ${natCount}`);

  const { count: stateCount } = await supabase
    .from('economic_state')
    .select('*', { count: 'exact', head: true })
    .not('employment_yoy', 'is', null);
  console.log(`  State with employment_yoy: ${stateCount}`);

  const { count: metroCount } = await supabase
    .from('economic_metro')
    .select('*', { count: 'exact', head: true })
    .not('employment_yoy', 'is', null);
  console.log(`  Metro with employment_yoy: ${metroCount}`);
}

verify().catch(console.error);
