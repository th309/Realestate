import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Checking ZORDI data in zillow_metro...\n');

  // Count records and unique metros for each metric
  for (const metric of ['zordi', 'zordi_sfr', 'zordi_mfr']) {
    const { count: totalCount } = await supabase
      .from('zillow_metro')
      .select('*', { count: 'exact', head: true })
      .eq('metric_name', metric);

    // Get unique region count for latest date
    const { data: latestData } = await supabase
      .from('zillow_metro')
      .select('period_date')
      .eq('metric_name', metric)
      .order('period_date', { ascending: false })
      .limit(1);

    const latestDate = latestData?.[0]?.period_date;

    const { count: latestCount } = await supabase
      .from('zillow_metro')
      .select('*', { count: 'exact', head: true })
      .eq('metric_name', metric)
      .eq('period_date', latestDate);

    console.log(`${metric}:`);
    console.log(`  Total records: ${totalCount?.toLocaleString()}`);
    console.log(`  Latest date: ${latestDate}`);
    console.log(`  Metros on latest date: ${latestCount}`);
    console.log('');
  }

  // Compare with source CSV counts
  console.log('Source CSV metro counts (from import log):');
  console.log('  All Homes (zordi): 908 rows parsed, 35 skipped = ~873 with CBSA');
  console.log('  SFR (zordi_sfr): 803 rows parsed, 13 skipped = ~790 with CBSA');
  console.log('  MFR (zordi_mfr): 807 rows parsed, 19 skipped = ~788 with CBSA');
}

main().catch(console.error);
