/**
 * Get distinct region_ids from zillow_metro using RPC or group by approach
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    db: {
      schema: 'public',
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function getDistinct() {
  console.log('Getting distinct region_ids from zillow_metro...\n');

  // Try using SQL directly via rpc if available
  // If not, we'll need to query specific region_ids we know exist

  // Get total count
  const { count: total } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true });

  console.log(`Total rows in zillow_metro: ${total?.toLocaleString()}`);

  // Get count by metric_name
  console.log('\nTrying to get metric counts...');

  // Get a sample to understand the data structure
  const { data: sample } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, metric_name, cbsa_code')
    .limit(20);

  console.log('\nSample rows:');
  sample?.forEach(r => {
    console.log(`  ${r.region_id}: "${r.region_name}" - ${r.metric_name} (cbsa: ${r.cbsa_code || 'NULL'})`);
  });

  // Get count for specific metrics we expect
  const metrics = ['zhvi', 'zori', 'zhvf', 'price_cuts', 'new_con_sales', 'inventory', 'new_con_price', 'affordable_price'];

  console.log('\nCounts by metric:');
  for (const metric of metrics) {
    const { count } = await supabase
      .from('zillow_metro')
      .select('*', { count: 'exact', head: true })
      .eq('metric_name', metric);

    if (count && count > 0) {
      console.log(`  ${metric}: ${count.toLocaleString()}`);
    }
  }

  // Count rows with/without CBSA code
  const { count: withCbsa } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .not('cbsa_code', 'is', null);

  const { count: withoutCbsa } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .is('cbsa_code', null);

  console.log('\nCBSA code status:');
  console.log(`  With CBSA code: ${withCbsa?.toLocaleString() || 0}`);
  console.log(`  Without CBSA code: ${withoutCbsa?.toLocaleString() || 0}`);
}

getDistinct().catch(console.error);
