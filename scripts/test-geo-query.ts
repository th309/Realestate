import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function test() {
  console.log('Testing geographies query...');

  const { data, error } = await supabase
    .from('geographies')
    .select('geography_id, name, state_code, population')
    .eq('geography_type', 'state')
    .order('name')
    .limit(5);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('States found:', data?.length);
    console.log('Sample:', JSON.stringify(data, null, 2));
  }
}

test();
