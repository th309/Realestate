/**
 * Check income_to_buy counts accurately
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function check() {
  console.log('Checking income_to_buy counts...\n');

  // Total count
  const { count: total } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .not('income_to_buy', 'is', null);

  console.log(`Total income_to_buy records: ${total}`);

  // By geography type
  for (const geo of ['national', 'state', 'metro', 'county', 'zip']) {
    const { count } = await supabase
      .from('calculated_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', geo)
      .not('income_to_buy', 'is', null);

    console.log(`  ${geo}: ${count}`);
  }

  // By period_date
  console.log('\nBy period_date:');
  const { data: dateData } = await supabase
    .from('calculated_metrics')
    .select('period_date')
    .not('income_to_buy', 'is', null);

  const dateCounts: Record<string, number> = {};
  for (const row of dateData || []) {
    dateCounts[row.period_date] = (dateCounts[row.period_date] || 0) + 1;
  }

  for (const [date, cnt] of Object.entries(dateCounts).sort()) {
    console.log(`  ${date}: ${cnt}`);
  }
}

check().catch(console.error);
