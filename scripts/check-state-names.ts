import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function check() {
  // Check what state names look like for affordable_home_price
  const { data: ahp } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, affordable_home_price')
    .eq('geography_type', 'state')
    .not('affordable_home_price', 'is', null)
    .limit(10);

  console.log('State affordable_home_price in calculated_metrics:');
  ahp?.forEach(r => console.log(`  ${r.geography_id} -> "${r.geography_name}": $${Number(r.affordable_home_price).toLocaleString()}`));

  // Compare with what income_to_buy has
  const { data: itb } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, income_to_buy')
    .eq('geography_type', 'state')
    .not('income_to_buy', 'is', null)
    .limit(10);

  console.log('\nState income_to_buy in calculated_metrics:');
  itb?.forEach(r => console.log(`  ${r.geography_id} -> "${r.geography_name}": $${Number(r.income_to_buy).toLocaleString()}`));
}

check().catch(console.error);
