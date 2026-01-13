import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Get counts by geography
  const geos = ['state', 'State', 'metro', 'Metro', 'county', 'County', 'city', 'City', 'zip', 'Zip', 'msa', 'MSA'];

  console.log('Record counts by geography value:\n');

  for (const geo of geos) {
    const { count } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geo);

    if (count && count > 0) {
      console.log(`"${geo}": ${count.toLocaleString()} records`);
    }
  }

  // Also check total
  const { count: total } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true });
  console.log(`\nTotal: ${total?.toLocaleString()} records`);

  // Check sample of distinct geography values
  const { data: sample } = await supabase
    .from('zillow_zhvi')
    .select('geography')
    .limit(5000);

  const uniqueGeos = [...new Set(sample?.map(d => d.geography))];
  console.log('\nUnique geography values found:', uniqueGeos);
}

check().catch(console.error);
