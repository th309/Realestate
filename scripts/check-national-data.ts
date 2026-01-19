import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function check() {
  // Check national calculated_metrics
  const { data: national } = await supabase
    .from('calculated_metrics')
    .select('*')
    .eq('geography_type', 'national');

  console.log('National calculated_metrics:');
  national?.forEach(r => {
    console.log(`  ID: ${r.geography_id}, Name: ${r.geography_name}`);
    console.log(`  income_to_buy: ${r.income_to_buy}`);
    console.log(`  affordable_home_price: ${r.affordable_home_price}`);
    console.log(`  period_date: ${r.period_date}`);
  });

  // Check census_national
  const { data: census } = await supabase
    .from('census_national')
    .select('year, median_household_income')
    .not('median_household_income', 'is', null)
    .order('year', { ascending: false })
    .limit(3);

  console.log('\nCensus national income:');
  census?.forEach(r => console.log(`  Year ${r.year}: $${r.median_household_income?.toLocaleString()}`));
}

check().catch(console.error);
