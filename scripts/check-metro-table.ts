/**
 * Check zillow_metro table contents
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking zillow_metro table...\n');

  // Count total rows
  const { count: total } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true });

  console.log(`Total rows: ${total?.toLocaleString()}`);

  // Get sample to count metrics and region_ids
  const allRegionIds = new Set<number>();
  const metricCounts = new Map<string, number>();
  let offset = 0;
  const batchSize = 50000;

  while (true) {
    const { data: batch } = await supabase
      .from('zillow_metro')
      .select('region_id, metric_name')
      .range(offset, offset + batchSize - 1);

    if (!batch || batch.length === 0) break;

    for (const r of batch) {
      allRegionIds.add(r.region_id);
      metricCounts.set(r.metric_name, (metricCounts.get(r.metric_name) || 0) + 1);
    }

    offset += batchSize;
    if (batch.length < batchSize) break;
  }

  console.log(`Unique region_ids: ${allRegionIds.size}`);
  console.log('\nMetrics in table:');
  for (const [name, count] of metricCounts) {
    console.log(`  ${name}: ${count.toLocaleString()}`);
  }
}

check().catch(console.error);
