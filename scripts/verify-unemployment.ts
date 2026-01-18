/**
 * Verify unemployment data in database
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function verify() {
  console.log('Verifying Unemployment Data');
  console.log('='.repeat(60));

  // National unemployment
  const { data: national } = await supabase
    .from('economic_national')
    .select('period_date, unemployment_rate')
    .not('unemployment_rate', 'is', null)
    .order('period_date', { ascending: false })
    .limit(5);

  console.log('\nNational Unemployment (latest 5):');
  console.table(national);

  // State unemployment (California)
  const { data: state } = await supabase
    .from('economic_state')
    .select('period_date, state_name, unemployment_rate')
    .eq('state_fips', '06')
    .not('unemployment_rate', 'is', null)
    .order('period_date', { ascending: false })
    .limit(5);

  console.log('\nState Unemployment (California):');
  console.table(state);

  // Metro unemployment
  const { data: metro } = await supabase
    .from('economic_metro')
    .select('period_date, cbsa_code, unemployment_rate')
    .not('unemployment_rate', 'is', null)
    .order('period_date', { ascending: false })
    .limit(10);

  console.log('\nMetro Unemployment (latest):');
  console.table(metro);

  // County unemployment
  const { data: county } = await supabase
    .from('economic_county')
    .select('period_date, fips_code, unemployment_rate')
    .not('unemployment_rate', 'is', null)
    .order('period_date', { ascending: false })
    .limit(10);

  console.log('\nCounty Unemployment (latest):');
  console.table(county);

  // Count records
  console.log('\n' + '='.repeat(60));
  console.log('UNEMPLOYMENT DATA COUNTS');
  console.log('='.repeat(60));

  const { count: natCount } = await supabase
    .from('economic_national')
    .select('*', { count: 'exact', head: true })
    .not('unemployment_rate', 'is', null);
  console.log(`  National with unemployment_rate: ${natCount}`);

  const { count: stateCount } = await supabase
    .from('economic_state')
    .select('*', { count: 'exact', head: true })
    .not('unemployment_rate', 'is', null);
  console.log(`  State with unemployment_rate: ${stateCount}`);

  const { count: metroCount } = await supabase
    .from('economic_metro')
    .select('*', { count: 'exact', head: true })
    .not('unemployment_rate', 'is', null);
  console.log(`  Metro with unemployment_rate: ${metroCount}`);

  const { count: countyCount } = await supabase
    .from('economic_county')
    .select('*', { count: 'exact', head: true })
    .not('unemployment_rate', 'is', null);
  console.log(`  County with unemployment_rate: ${countyCount}`);

  // Count unique counties
  const { data: uniqueCounties } = await supabase
    .from('economic_county')
    .select('fips_code')
    .not('unemployment_rate', 'is', null);

  const uniqueFips = new Set(uniqueCounties?.map(r => r.fips_code));
  console.log(`  Unique counties with unemployment data: ${uniqueFips.size}`);
}

verify().catch(console.error);
