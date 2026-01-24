import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function check() {
  // Get ONLY Sweetwater records with non-null cap_rate
  const { data: withCapRate } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, cap_rate, gross_yield, grm, period_date')
    .eq('geography_type', 'county')
    .ilike('geography_name', '%sweetwater%')
    .not('cap_rate', 'is', null);

  console.log('Sweetwater records WITH cap_rate:');
  console.log(JSON.stringify(withCapRate, null, 2));

  // Count total Sweetwater records
  const { count: totalCount } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('geography_type', 'county')
    .ilike('geography_name', '%sweetwater%');

  console.log('\nTotal Sweetwater records:', totalCount);

  // Check the API endpoint directly - what would it return?
  // Query exactly like getInvestmentMetricsForMap does
  const { data: latestRow } = await supabase
    .from('calculated_metrics')
    .select('period_date')
    .eq('geography_type', 'county')
    .not('cap_rate', 'is', null)
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  console.log('\nLatest period_date for county cap_rate:', latestRow?.period_date);

  if (latestRow?.period_date) {
    const { data: apiData } = await supabase
      .from('calculated_metrics')
      .select('geography_id, geography_name, cap_rate, period_date')
      .eq('geography_type', 'county')
      .eq('period_date', latestRow.period_date)
      .not('cap_rate', 'is', null);

    console.log('\nTotal county records API would return:', apiData?.length);

    // Find Sweetwater in this data
    const sweetwaterApi = apiData?.filter(r => r.geography_name.toLowerCase().includes('sweetwater'));
    console.log('Sweetwater in API response:', JSON.stringify(sweetwaterApi, null, 2));
  }
}

check().catch(console.error);
