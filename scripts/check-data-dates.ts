import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const tables = [
    'zillow_zip',
    'realtor_zip',
    'census_county',
    'economic_county',
    'economic_national',
    'hud_fmr',
    'permits_county',
  ];

  for (const table of tables) {
    console.log(`=== ${table} ===`);
    const { data, error } = await supabase
      .from(table)
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.log('Error:', error.message);
    } else if (!data || data.length === 0) {
      console.log('No data in table');
    } else {
      console.log('Latest created_at:', data[0].created_at);
    }
    console.log('');
  }
}

check();
