/**
 * Check price data coverage for Income-to-Buy proxy calculation
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Try multiple env locations
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCoverage() {
  const tables = [
    { name: 'realtor_national', priceCol: 'median_listing_price', geoName: 'National' },
    { name: 'realtor_state', priceCol: 'median_listing_price', geoName: 'State' },
    { name: 'realtor_metro', priceCol: 'median_listing_price', geoName: 'Metro' },
    { name: 'realtor_county', priceCol: 'median_listing_price', geoName: 'County' },
    { name: 'realtor_zip', priceCol: 'median_listing_price', geoName: 'ZIP' },
  ];

  console.log('='.repeat(60));
  console.log('PRICE DATA COVERAGE FOR INCOME-TO-BUY PROXY');
  console.log('='.repeat(60));
  console.log('');

  for (const t of tables) {
    const { count } = await supabase
      .from(t.name)
      .select('*', { count: 'exact', head: true })
      .not(t.priceCol, 'is', null);

    // Get latest date
    const { data: latest } = await supabase
      .from(t.name)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    let uniqueGeos = 0;
    let latestDate = 'N/A';
    if (latest) {
      latestDate = latest.period_date;
      const { count: geoCount } = await supabase
        .from(t.name)
        .select('*', { count: 'exact', head: true })
        .eq('period_date', latest.period_date)
        .not(t.priceCol, 'is', null);
      uniqueGeos = geoCount || 0;
    }

    console.log(`${t.geoName.padEnd(10)} | ${String(uniqueGeos).padStart(6)} geographies | Latest: ${latestDate}`);
  }

  // Check Zillow ZHVI as alternative
  console.log('');
  console.log('Alternative: Zillow ZHVI (home value instead of listing price)');

  const { data: zhviLatest } = await supabase
    .from('zillow_metro')
    .select('period_date')
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (zhviLatest) {
    const { count } = await supabase
      .from('zillow_metro')
      .select('*', { count: 'exact', head: true })
      .eq('metric_name', 'zhvi')
      .eq('period_date', zhviLatest.period_date)
      .not('value', 'is', null);
    console.log(`Metro      | ${String(count || 0).padStart(6)} geographies | Latest: ${zhviLatest.period_date} (ZHVI)`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY: Can calculate Income-to-Buy proxy for:');
  console.log('  - National (1)');
  console.log('  - States (~51)');
  console.log('  - Metros (~900+)');
  console.log('  - Counties (~3000+)');
  console.log('  - ZIPs (~25000+)');
  console.log('='.repeat(60));
}

checkCoverage().catch(console.error);
