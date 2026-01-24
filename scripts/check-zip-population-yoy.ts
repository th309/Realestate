/**
 * Quick script to verify population_yoy values in census_zip table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });
config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Checking population_yoy values in census_zip...\n');

  // Count records with non-null population_yoy for 2023
  const { count: withYoY } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .eq('year', 2023)
    .not('population_yoy', 'is', null);

  const { count: total2023 } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .eq('year', 2023);

  console.log(`2023 ZIP records with population_yoy: ${withYoY} / ${total2023}`);

  // Sample some records
  const { data: samples } = await supabase
    .from('census_zip')
    .select('zcta, total_population, population_yoy')
    .eq('year', 2023)
    .not('population_yoy', 'is', null)
    .order('total_population', { ascending: false })
    .limit(10);

  console.log('\nTop 10 ZIPs by population with YoY growth:');
  console.log('ZCTA\t\tPopulation\tYoY Growth');
  console.log('-'.repeat(50));
  for (const row of samples || []) {
    const growth = row.population_yoy !== null ? `${row.population_yoy > 0 ? '+' : ''}${row.population_yoy}%` : 'N/A';
    console.log(`${row.zcta}\t\t${row.total_population?.toLocaleString()}\t\t${growth}`);
  }

  // Distribution of growth rates
  const { data: distribution } = await supabase
    .from('census_zip')
    .select('population_yoy')
    .eq('year', 2023)
    .not('population_yoy', 'is', null);

  if (distribution && distribution.length > 0) {
    const values = distribution.map(r => r.population_yoy).filter(v => v !== null);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const positive = values.filter(v => v > 0).length;
    const negative = values.filter(v => v < 0).length;
    const zero = values.filter(v => v === 0).length;

    console.log('\nDistribution:');
    console.log(`  Average YoY: ${avg.toFixed(2)}%`);
    console.log(`  Positive growth: ${positive} (${(positive/values.length*100).toFixed(1)}%)`);
    console.log(`  Negative growth: ${negative} (${(negative/values.length*100).toFixed(1)}%)`);
    console.log(`  Zero growth: ${zero} (${(zero/values.length*100).toFixed(1)}%)`);
  }
}

main().catch(console.error);
