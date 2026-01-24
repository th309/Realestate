import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function check() {
  // Check all columns in calculated_metrics
  const { data: sample } = await supabase
    .from('calculated_metrics')
    .select('*')
    .eq('geography_type', 'county')
    .limit(1)
    .single();

  console.log('Sample county record columns:', Object.keys(sample || {}));

  // Check Sweetwater specifically
  const { data: sweetwater } = await supabase
    .from('calculated_metrics')
    .select('*')
    .eq('geography_type', 'county')
    .ilike('geography_name', '%sweetwater%');

  console.log('\nAll Sweetwater county records:');
  console.log(JSON.stringify(sweetwater, null, 2));

  // Check if there's a cap_rate_proxy or other similar column with bad values
  const { data: proxyMax } = await supabase
    .from('calculated_metrics')
    .select('geography_name, cap_rate_proxy')
    .eq('geography_type', 'county')
    .not('cap_rate_proxy', 'is', null)
    .order('cap_rate_proxy', { ascending: false })
    .limit(5);

  console.log('\nTop 5 cap_rate_proxy values:');
  console.log(JSON.stringify(proxyMax, null, 2));

  // Check gross_yield column
  const { data: yieldMax } = await supabase
    .from('calculated_metrics')
    .select('geography_name, gross_yield')
    .eq('geography_type', 'county')
    .not('gross_yield', 'is', null)
    .order('gross_yield', { ascending: false })
    .limit(5);

  console.log('\nTop 5 gross_yield values:');
  console.log(JSON.stringify(yieldMax, null, 2));
}

check().catch(console.error);
