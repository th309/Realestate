/**
 * Check available income data sources
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking income data sources...\n');

  // Check zillow_affordability table (has income_needed fields)
  const { data: zillowAff, count: zillowCount } = await supabase
    .from('zillow_affordability')
    .select('*', { count: 'exact' })
    .limit(5);

  console.log(`zillow_affordability: ${zillowCount} records`);
  if (zillowAff && zillowAff.length > 0) {
    console.log('Sample columns:', Object.keys(zillowAff[0]).join(', '));
  }

  // Check economic_data table
  const { data: econData, count: econCount } = await supabase
    .from('economic_data')
    .select('metric_name', { count: 'exact' })
    .limit(100);

  console.log(`\neconomic_data: ${econCount} records`);
  if (econData) {
    const metrics = [...new Set(econData.map(d => d.metric_name))];
    console.log('Metrics:', metrics.slice(0, 10).join(', '));
  }

  // Check census_data table
  const { count: censusCount } = await supabase
    .from('census_data')
    .select('*', { count: 'exact', head: true });

  console.log(`\ncensus_data: ${censusCount} records`);

  // Check if there's per_capita_income in economic_data
  const { data: incomeCheck, count: incomeCount } = await supabase
    .from('economic_data')
    .select('*', { count: 'exact' })
    .ilike('metric_name', '%income%')
    .limit(5);

  console.log(`\nIncome-related in economic_data: ${incomeCount} records`);
  if (incomeCheck && incomeCheck.length > 0) {
    for (const row of incomeCheck) {
      console.log(`  ${row.geography_type} ${row.geography_id}: ${row.metric_name} = ${row.value}`);
    }
  }
}

check().catch(console.error);
