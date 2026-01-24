import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get distinct dates from realtor_state
  const { data, error } = await supabase
    .from('realtor_state')
    .select('period_date')
    .order('period_date', { ascending: false });

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  // Get unique dates
  const uniqueDates = [...new Set(data?.map(d => d.period_date))];
  console.log(`Total records returned: ${data?.length}`);
  console.log(`Unique dates: ${uniqueDates.length}`);
  console.log(`\nFirst 10 dates: ${uniqueDates.slice(0, 10).join(', ')}`);
  console.log(`Last 10 dates: ${uniqueDates.slice(-10).join(', ')}`);
}

main();
