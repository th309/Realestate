import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function debug() {
  // Check County records
  console.log('Checking County records...\n');

  const { count: totalCounty } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County');
  console.log('Total County records:', totalCounty?.toLocaleString());

  const { count: nullYoy } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County')
    .is('yoy_growth', null);
  console.log('County with NULL yoy_growth:', nullYoy?.toLocaleString());

  const { count: hasYoy } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County')
    .not('yoy_growth', 'is', null);
  console.log('County with yoy_growth:', hasYoy?.toLocaleString());

  // Sample County records
  const { data: sample } = await supabase
    .from('zillow_zhvi')
    .select('id, region_id, date, value, yoy_growth')
    .eq('geography', 'County')
    .order('id', { ascending: true })
    .limit(5);

  console.log('\nSample County records:');
  console.log(sample);

  // Check if there's data from 12 months ago
  console.log('\nChecking date range for County...');
  const { data: dateRange } = await supabase
    .from('zillow_zhvi')
    .select('date')
    .eq('geography', 'County')
    .order('date', { ascending: true })
    .limit(1);

  const { data: maxDate } = await supabase
    .from('zillow_zhvi')
    .select('date')
    .eq('geography', 'County')
    .order('date', { ascending: false })
    .limit(1);

  console.log('Min date:', dateRange?.[0]?.date);
  console.log('Max date:', maxDate?.[0]?.date);
}

debug().catch(console.error);
