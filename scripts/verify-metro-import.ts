import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function verify() {
  console.log('Verifying Metro ZHVI import...\n');

  // Count by geography
  const geos = ['State', 'Metro', 'County', 'City', 'Zip', null, ''];
  for (const geo of geos) {
    const query = supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true });

    if (geo === null) {
      query.is('geography', null);
    } else if (geo === '') {
      query.eq('geography', '');
    } else {
      query.eq('geography', geo);
    }

    const { count } = await query;
    if (count && count > 0) {
      console.log(`Geography "${geo}": ${count.toLocaleString()} records`);
    }
  }

  // Check Metro date range
  console.log('\nMetro date range:');
  const { data: dates } = await supabase
    .from('zillow_zhvi')
    .select('date')
    .eq('geography', 'Metro')
    .order('date', { ascending: true })
    .limit(1);

  const { data: maxDates } = await supabase
    .from('zillow_zhvi')
    .select('date')
    .eq('geography', 'Metro')
    .order('date', { ascending: false })
    .limit(1);

  console.log('Min:', dates?.[0]?.date);
  console.log('Max:', maxDates?.[0]?.date);

  // Sample of Metro records
  const { data: sample } = await supabase
    .from('zillow_zhvi')
    .select('*')
    .eq('geography', 'Metro')
    .order('date', { ascending: true })
    .limit(3);

  console.log('\nSample early Metro records:', sample);
}

verify().catch(console.error);
