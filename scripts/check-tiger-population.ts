import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Standard pagination helper - use count: 'exact' with head: true for counts
// Only paginate when we need to retrieve actual data

async function check() {
  console.log('Checking tiger_zcta population data...\n');

  // Check if tiger_zcta has population for the "missing" CA ZCTAs
  // Using limit(20) is fine for samples
  const { data: missingWithPop } = await supabase
    .from('tiger_zcta')
    .select('geoid, population, default_city')
    .eq('default_state', 'CA')
    .not('population', 'is', null)
    .gt('population', 0)
    .limit(20);

  console.log('Sample CA ZCTAs with population in tiger_zcta:');
  console.log(missingWithPop);

  // Count queries use head: true which returns count without row limit issues
  const { count: caWithPop } = await supabase
    .from('tiger_zcta')
    .select('*', { count: 'exact', head: true })
    .eq('default_state', 'CA')
    .not('population', 'is', null)
    .gt('population', 0);

  console.log('\nCA ZCTAs with population > 0 in tiger_zcta:', caWithPop);

  // Check the specific "missing" ZCTAs - single row lookups don't need pagination
  const missingZctas = ['92357', '92366', '92375', '90009', '90030', '90050'];
  console.log('\nChecking specific missing ZCTAs in tiger_zcta:');
  for (const zcta of missingZctas) {
    const { data } = await supabase
      .from('tiger_zcta')
      .select('geoid, population')
      .eq('geoid', zcta)
      .single();

    console.log(`  ${zcta}: population = ${data?.population ?? 'null'}`);
  }

  // Count queries with head: true are safe
  const { count: totalWithPop } = await supabase
    .from('tiger_zcta')
    .select('*', { count: 'exact', head: true })
    .not('population', 'is', null)
    .gt('population', 0);

  const { count: total } = await supabase
    .from('tiger_zcta')
    .select('*', { count: 'exact', head: true });

  console.log('\n=== Overall tiger_zcta population coverage ===');
  console.log('Total ZCTAs:', total);
  console.log('ZCTAs with population > 0:', totalWithPop);
  console.log('Coverage:', ((totalWithPop || 0) / (total || 1) * 100).toFixed(1) + '%');

  // For TN - count queries are safe
  const { count: tnWithPop } = await supabase
    .from('tiger_zcta')
    .select('*', { count: 'exact', head: true })
    .eq('default_state', 'TN')
    .not('population', 'is', null)
    .gt('population', 0);

  const { count: tnTotal } = await supabase
    .from('tiger_zcta')
    .select('*', { count: 'exact', head: true })
    .eq('default_state', 'TN');

  console.log('\nTN ZCTAs in tiger_zcta:', tnTotal);
  console.log('TN ZCTAs with population > 0:', tnWithPop);
}

check().catch(console.error);
