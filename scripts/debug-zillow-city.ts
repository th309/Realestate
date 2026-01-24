import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function debug() {
  console.log('Debugging zillow_city...\n');

  // Check total row count
  const { count: totalCount } = await supabase
    .from('zillow_city')
    .select('*', { count: 'exact', head: true });
  console.log('Total zillow_city rows:', totalCount);

  // Check distinct region_names
  const { data: regionNames } = await supabase
    .from('zillow_city')
    .select('region_name')
    .limit(20);
  console.log('Sample region_names:', [...new Set(regionNames?.map(r => r.region_name))]);

  // Try exact match on Miami
  console.log('\n--- Exact match "Miami" ---');
  const { data: exact, error: exactErr } = await supabase
    .from('zillow_city')
    .select('region_name, state_code, metric_name, value')
    .eq('region_name', 'Miami')
    .limit(5);
  console.log('Error:', exactErr?.message);
  console.log('Data:', exact);

  // Try ILIKE match
  console.log('\n--- ILIKE match "%Miami%" ---');
  const { data: ilike, count: ilikeCount } = await supabase
    .from('zillow_city')
    .select('region_name, state_code, metric_name', { count: 'exact' })
    .ilike('region_name', '%Miami%')
    .limit(5);
  console.log('Count:', ilikeCount);
  console.log('Data:', ilike);

  // Check metric_name values
  console.log('\n--- Distinct metric_name values ---');
  const { data: metrics } = await supabase
    .from('zillow_city')
    .select('metric_name')
    .limit(100);
  const uniqueMetrics = [...new Set(metrics?.map(m => m.metric_name))];
  console.log('Metrics:', uniqueMetrics);
}

debug().catch(console.error);
