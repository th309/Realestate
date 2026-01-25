import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: 'packages/frontend/.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Checking data distribution by geography type...\n');
  
  const { data } = await supabase
    .from('propertyiq_scores')
    .select('geography, location_id, location_name, score_type')
    .eq('score_date', '2025-12-01')
    .limit(30);
  
  console.log('Sample records:');
  console.log('Geography | Location ID | Score Type    | Location Name');
  console.log('----------|-------------|---------------|------------------');
  data?.forEach(d => {
    console.log(`${d.geography.padEnd(9)} | ${d.location_id.padEnd(11)} | ${d.score_type.padEnd(13)} | ${d.location_name}`);
  });
  
  // Count by geography
  console.log('\n\nCounts by geography type:');
  for (const geo of ['metro', 'county', 'zip']) {
    const { count } = await supabase
      .from('propertyiq_scores')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geo)
      .eq('score_date', '2025-12-01');
    console.log(`  ${geo}: ${count?.toLocaleString() || 0} records`);
  }
}

main().catch(console.error);
