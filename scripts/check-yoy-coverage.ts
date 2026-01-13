import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('YoY Coverage by Geography:\n');

  const geos = ['State', 'Metro', 'County', 'City', 'Zip'];
  for (const geo of geos) {
    const { count: total } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geo);

    const { count: withYoy } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geo)
      .not('yoy_growth', 'is', null);

    const pct = Math.round(100 * (withYoy || 0) / (total || 1));
    console.log(`${geo}: ${withYoy?.toLocaleString()} / ${total?.toLocaleString()} (${pct}%)`);
  }

  // Sample some YoY values
  const { data: sample } = await supabase
    .from('zillow_zhvi')
    .select('region_id, date, value, yoy_growth, geography')
    .not('yoy_growth', 'is', null)
    .order('date', { ascending: false })
    .limit(5);

  console.log('\nSample records with YoY:');
  sample?.forEach(r => {
    console.log(`  ${r.geography} ${r.region_id}: ${r.date} = $${r.value?.toLocaleString()} (YoY: ${r.yoy_growth}%)`);
  });
}

check().catch(console.error);
