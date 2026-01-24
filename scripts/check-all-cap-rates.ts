import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function check() {
  // Get ALL cap_rate values including any that might be wrong
  const { data: allCapRates, count } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, geography_type, cap_rate, period_date', { count: 'exact' })
    .not('cap_rate', 'is', null)
    .order('cap_rate', { ascending: false })
    .limit(20);

  console.log('Total cap_rate records:', count);
  console.log('\nTop 20 cap_rate values (highest first):');
  allCapRates?.forEach(r => {
    console.log(`  ${r.geography_type} | ${r.geography_name} | ${r.cap_rate}% | ${r.period_date}`);
  });

  // Check min/max range
  const { data: minMax } = await supabase.rpc('get_cap_rate_range');

  // Manual min/max
  const { data: maxRecord } = await supabase
    .from('calculated_metrics')
    .select('cap_rate')
    .not('cap_rate', 'is', null)
    .order('cap_rate', { ascending: false })
    .limit(1)
    .single();

  const { data: minRecord } = await supabase
    .from('calculated_metrics')
    .select('cap_rate')
    .not('cap_rate', 'is', null)
    .order('cap_rate', { ascending: true })
    .limit(1)
    .single();

  console.log('\nCap rate range:');
  console.log('  Min:', minRecord?.cap_rate);
  console.log('  Max:', maxRecord?.cap_rate);

  // Check for any suspicious values
  const { count: above100 } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .gt('cap_rate', 100);

  const { count: above1000 } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .gt('cap_rate', 1000);

  console.log('\nRecords > 100%:', above100);
  console.log('Records > 1000%:', above1000);

  // Check county specifically
  const { data: countyMax } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, cap_rate, period_date')
    .eq('geography_type', 'county')
    .not('cap_rate', 'is', null)
    .order('cap_rate', { ascending: false })
    .limit(5);

  console.log('\nTop 5 county cap rates:');
  countyMax?.forEach(r => {
    console.log(`  ${r.geography_name} (${r.geography_id}): ${r.cap_rate}% | ${r.period_date}`);
  });

  // Check unique period dates for county
  const { data: countyDates } = await supabase
    .from('calculated_metrics')
    .select('period_date')
    .eq('geography_type', 'county')
    .not('cap_rate', 'is', null);

  const uniqueDates = [...new Set(countyDates?.map(d => d.period_date))];
  console.log('\nUnique period_dates for county cap_rate:', uniqueDates);
}

check().catch(console.error);
