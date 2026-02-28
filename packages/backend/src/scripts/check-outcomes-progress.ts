/**
 * Quick script to check outcome population progress
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function check() {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  for (const geoType of ['metro', 'county', 'zip']) {
    const { count } = await client
      .from('propertyiq_backtest_outcomes')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', geoType);

    if (!count) {
      console.log(`  ${geoType}: 0 outcomes`);
      continue;
    }

    // Get date range
    const { data: first } = await client
      .from('propertyiq_backtest_outcomes')
      .select('score_date')
      .eq('geography_type', geoType)
      .order('score_date', { ascending: true })
      .limit(1);

    const { data: last } = await client
      .from('propertyiq_backtest_outcomes')
      .select('score_date')
      .eq('geography_type', geoType)
      .order('score_date', { ascending: false })
      .limit(1);

    // Estimate unique dates from count
    const perDate =
      geoType === 'metro' ? 2775 : geoType === 'county' ? 9417 : 84000;
    const estDates = Math.round(count / perDate);

    console.log(
      `  ${geoType}: ${count.toLocaleString()} outcomes (~${estDates}/60 dates) | ${first?.[0]?.score_date} → ${last?.[0]?.score_date}`,
    );
  }
}

check()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
