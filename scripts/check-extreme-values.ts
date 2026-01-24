import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function check() {
  // Check Sweetwater county
  const { data: sweetwater } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, cap_rate, period_date')
    .eq('geography_type', 'county')
    .ilike('geography_name', '%sweetwater%')
    .not('cap_rate', 'is', null);

  console.log('Sweetwater county records:', JSON.stringify(sweetwater, null, 2));

  // Check how many extreme values still exist
  const { count: extremeHigh } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .gt('cap_rate', 20);

  const { count: extremeLow } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .lt('cap_rate', 0);

  console.log('\nRecords with cap_rate > 20%:', extremeHigh);
  console.log('Records with cap_rate < 0%:', extremeLow);

  // Sample extreme values
  const { data: extremeSample } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, geography_type, cap_rate, period_date')
    .gt('cap_rate', 100)
    .limit(10);

  console.log('\nSample extreme values (cap_rate > 100%):', JSON.stringify(extremeSample, null, 2));
}

check().catch(console.error);
