import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function debug() {
  console.log('Date ranges by geography:\n');

  const geos = ['State', 'Metro', 'County', 'City', 'Zip'];

  for (const geo of geos) {
    const { data: minData } = await supabase
      .from('zillow_zhvi')
      .select('date')
      .eq('geography', geo)
      .order('date', { ascending: true })
      .limit(1);

    const { data: maxData } = await supabase
      .from('zillow_zhvi')
      .select('date')
      .eq('geography', geo)
      .order('date', { ascending: false })
      .limit(1);

    const { count } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geo);

    const min = minData?.[0]?.date || 'N/A';
    const max = maxData?.[0]?.date || 'N/A';

    console.log(`${geo}: ${min} to ${max} (${count?.toLocaleString()} records)`);
  }
}

debug().catch(console.error);
