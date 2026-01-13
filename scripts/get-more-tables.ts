import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function run() {
  // Check zillow_zhvi
  const { data: zhvi, count: zhviCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact' })
    .limit(1);
  console.log('zillow_zhvi (' + (zhviCount || 0).toLocaleString() + ' rows)');
  if (zhvi && zhvi[0]) console.log('  Columns:', Object.keys(zhvi[0]).join(', '));

  // Check more tables
  const moreTables = [
    'reports', 'report_conversations', 'user_report_memory', 'news_cache',
    'census_data', 'census_demographics', 'census_economics', 'census_housing',
    'fred_data', 'fred_economic_data', 'redfin_metrics',
    'metric_definitions', 'metric_percentiles', 'calculated_metrics',
    'propertyiq_scores', 'market_signals'
  ];

  console.log('\n--- ADDITIONAL TABLES CHECK ---');
  for (const t of moreTables) {
    try {
      const { data, count, error } = await supabase.from(t).select('*', { count: 'exact' }).limit(1);
      if (!error) {
        console.log(`\n${t} (${(count || 0).toLocaleString()} rows)`);
        if (data && data[0]) console.log('  Columns:', Object.keys(data[0]).join(', '));
        else console.log('  Columns: (table exists but empty)');
      }
    } catch(e) {
      // Table doesn't exist
    }
  }
}

run().catch(console.error);
