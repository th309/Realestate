import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: './packages/backend/.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function verify() {
  console.log('Verifying permits data...\n');

  // Count records
  const { count: countyCount } = await supabase
    .from('permits_county')
    .select('*', { count: 'exact', head: true });

  const { count: stateCount } = await supabase
    .from('permits_state')
    .select('*', { count: 'exact', head: true });

  console.log('Record counts:');
  console.log(`  permits_county: ${countyCount}`);
  console.log(`  permits_state: ${stateCount}`);

  // Sample LA County data
  const { data: laData } = await supabase
    .from('permits_county')
    .select('period_date, county_name, sf_units, total_units')
    .eq('fips_code', '06037')
    .order('period_date', { ascending: false })
    .limit(5);

  console.log('\nLA County (06037) recent permits:');
  if (laData) {
    for (const r of laData) {
      console.log(`  ${r.period_date}: SF=${r.sf_units}, Total=${r.total_units}`);
    }
  }

  // Texas state totals
  const { data: txData } = await supabase
    .from('permits_state')
    .select('period_date, sf_units, total_units')
    .eq('state_fips', '48')
    .order('period_date', { ascending: false })
    .limit(3);

  console.log('\nTexas (48) recent permits:');
  if (txData) {
    for (const r of txData) {
      console.log(`  ${r.period_date}: SF=${r.sf_units}, Total=${r.total_units}`);
    }
  }
}

verify().catch(console.error);
