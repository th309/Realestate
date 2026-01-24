import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Date ranges by table:\n');

  const tables = [
    'realtor_state', 'realtor_metro', 'realtor_county', 'realtor_zip',
    'zillow_metro', 'zillow_county', 'zillow_zip'
  ];

  for (const table of tables) {
    try {
      const { data: minData } = await supabase
        .from(table)
        .select('period_date')
        .order('period_date', { ascending: true })
        .limit(1);

      const { data: maxData } = await supabase
        .from(table)
        .select('period_date')
        .order('period_date', { ascending: false })
        .limit(1);

      if (minData?.[0] && maxData?.[0]) {
        const minDate = minData[0].period_date;
        const maxDate = maxData[0].period_date;
        console.log(`${table.padEnd(20)}: ${minDate} to ${maxDate}`);
      }
    } catch (e: any) {
      console.log(`${table.padEnd(20)}: ERROR - ${e.message}`);
    }
  }
}

main();
