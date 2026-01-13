import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Get distinct years for Metro
  const { data: early } = await supabase
    .from('zillow_zhvi')
    .select('date')
    .eq('geography', 'Metro')
    .order('date', { ascending: true })
    .limit(5);

  const { data: late } = await supabase
    .from('zillow_zhvi')
    .select('date')
    .eq('geography', 'Metro')
    .order('date', { ascending: false })
    .limit(5);

  console.log('Earliest Metro dates:', early?.map(d => d.date));
  console.log('Latest Metro dates:', late?.map(d => d.date));

  // Get count for specific years
  for (const year of [2000, 2010, 2020, 2024, 2025]) {
    const { count } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', 'Metro')
      .gte('date', `${year}-01-01`)
      .lt('date', `${year + 1}-01-01`);
    console.log(`Metro ${year}: ${count || 0} records`);
  }
}

check().catch(console.error);
