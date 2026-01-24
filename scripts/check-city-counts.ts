import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const states = ['CA', 'TX', 'FL', 'NY', 'IL', 'PA', 'OH'];
  const fipsMap: Record<string, string> = {
    CA: '06', TX: '48', FL: '12', NY: '36', IL: '17', PA: '42', OH: '39'
  };

  console.log('City counts per state:');
  for (const state of states) {
    const { count } = await supabase
      .from('census_city')
      .select('*', { count: 'exact', head: true })
      .eq('year', 2023)
      .eq('state_fips', fipsMap[state]);
    console.log(`  ${state}: ${count}`);
  }

  // Also check counties
  console.log('\nCounty counts per state:');
  for (const state of states) {
    const { count } = await supabase
      .from('census_county')
      .select('*', { count: 'exact', head: true })
      .eq('year', 2023)
      .eq('state_fips', fipsMap[state]);
    console.log(`  ${state}: ${count}`);
  }
}

check().catch(console.error);
