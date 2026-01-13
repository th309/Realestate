import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Check unique region_ids without cbsa_code
  const { data } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name')
    .is('cbsa_code', null)
    .limit(50000);

  const unique = [...new Map((data || []).map(r => [r.region_id, r])).values()];
  console.log(`Region IDs still without CBSA code: ${unique.length}`);
  unique.forEach(r => console.log(`  ${r.region_id}: ${r.region_name}`));

  // Check unique region_ids WITH cbsa_code
  const { data: withCbsa } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, cbsa_code')
    .not('cbsa_code', 'is', null)
    .limit(50000);

  const uniqueWith = [...new Map((withCbsa || []).map(r => [r.region_id, r])).values()];
  console.log(`\nRegion IDs WITH CBSA code: ${uniqueWith.length}`);
  uniqueWith.slice(0, 10).forEach(r => console.log(`  ${r.region_id} (${r.cbsa_code}): ${r.region_name}`));
}

check();
