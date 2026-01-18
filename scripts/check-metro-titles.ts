import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('economic_metro')
    .select('cbsa_code, cbsa_title, period_date, unemployment_rate')
    .eq('cbsa_code', '12420')
    .order('period_date', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Austin TX Metro Data:');
    console.log(JSON.stringify(data, null, 2));
  }
}

check();
