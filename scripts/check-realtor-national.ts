import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('realtor_national')
    .select('*')
    .order('period_date', { ascending: false })
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
  } else if (data && data.length > 0) {
    console.log('realtor_national columns:', Object.keys(data[0]));
    console.log('Latest row:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('No data in realtor_national');
  }
}

check().catch(console.error);
