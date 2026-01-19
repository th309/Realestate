/**
 * Check Census income data coverage
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function check() {
  console.log('Census median_income coverage:\n');

  for (const geoType of ['state', 'metro', 'county', 'zip']) {
    const { count } = await supabase
      .from('census_data')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', geoType)
      .eq('metric_name', 'median_income')
      .not('value', 'is', null);

    console.log(`${geoType.padEnd(10)}: ${count || 0} records`);
  }

  // Sample some data
  console.log('\nSample state data:');
  const { data: stateData } = await supabase
    .from('census_data')
    .select('geography_id, geography_name, value, year')
    .eq('geography_type', 'state')
    .eq('metric_name', 'median_income')
    .not('value', 'is', null)
    .order('value', { ascending: false })
    .limit(5);

  for (const row of stateData || []) {
    console.log(`  ${row.geography_name}: $${Number(row.value).toLocaleString()} (${row.year})`);
  }
}

check().catch(console.error);
