import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function check() {
  const { data } = await supabase
    .from('calculated_metrics')
    .select('geography_name, years_to_save, income_to_buy, affordable_home_price, period_date')
    .eq('geography_type', 'national')
    .not('years_to_save', 'is', null)
    .order('period_date', { ascending: false })
    .limit(1);

  console.log('National years_to_save:');
  data?.forEach(r => {
    console.log('  Name:', r.geography_name);
    console.log('  Years to Save:', r.years_to_save, 'years');
    console.log('  Income to Buy: $' + r.income_to_buy?.toLocaleString());
    console.log('  Affordable Home Price: $' + r.affordable_home_price?.toLocaleString());
    console.log('  Period Date:', r.period_date);
  });
}

check().catch(console.error);
