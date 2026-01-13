import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function verify() {
  // Count rows by cbsa_code status
  const { count: withCbsa } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .not('cbsa_code', 'is', null);

  const { count: nullCbsa } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .is('cbsa_code', null);

  console.log(`Rows WITH cbsa_code: ${withCbsa}`);
  console.log(`Rows with NULL cbsa_code: ${nullCbsa}`);
  console.log(`Total: ${(withCbsa || 0) + (nullCbsa || 0)}`);

  // Check unique region_ids
  const { data: allData } = await supabase
    .from('zillow_metro')
    .select('region_id, cbsa_code')
    .limit(100000);

  const byRegion = new Map<number, { withCbsa: number; nullCbsa: number }>();
  for (const row of allData || []) {
    const key = row.region_id;
    if (!byRegion.has(key)) {
      byRegion.set(key, { withCbsa: 0, nullCbsa: 0 });
    }
    const entry = byRegion.get(key)!;
    if (row.cbsa_code) {
      entry.withCbsa++;
    } else {
      entry.nullCbsa++;
    }
  }

  console.log(`\nUnique region_ids found: ${byRegion.size}`);
  console.log('\nBreakdown by region_id (sample of 100k rows):');
  for (const [regionId, counts] of byRegion) {
    console.log(`  ${regionId}: ${counts.withCbsa} with cbsa, ${counts.nullCbsa} NULL`);
  }

  // Specific check for region_id 394436 which should have cbsa_code
  const { data: specific } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, cbsa_code, metric_name')
    .eq('region_id', 394436)
    .limit(5);

  console.log('\nSample rows for region_id 394436:');
  specific?.forEach(r => console.log(`  ${r.region_id} ${r.metric_name}: cbsa=${r.cbsa_code}`));
}

verify();
