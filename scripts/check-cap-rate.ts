import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function fetchAllIds(table: string, field: string, filter?: { column: string; value: any }): Promise<Set<string>> {
  const ids = new Set<string>();
  const PAGE_SIZE = 1000;
  let offset = 0;

  while (true) {
    let query = supabase.from(table).select(field);
    if (filter) {
      query = query.eq(filter.column, filter.value);
    }
    query = query.not(field === 'value' ? 'value' : field, 'is', null);
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);

    if (error || !data || data.length === 0) break;
    data.forEach((r: Record<string, unknown>) => {
      const val = r[field.split(',')[0].trim()];
      if (val) ids.add(String(val));
    });
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }

  return ids;
}

async function check() {
  console.log('Fetching data (this may take a moment)...\n');

  // Use exact counts instead for cap_rate
  const { count: metroCount } = await supabase
    .from('calculated_metrics')
    .select('geography_id', { count: 'exact', head: true })
    .eq('geography_type', 'metro')
    .not('cap_rate', 'is', null);

  const { count: countyCount } = await supabase
    .from('calculated_metrics')
    .select('geography_id', { count: 'exact', head: true })
    .eq('geography_type', 'county')
    .not('cap_rate', 'is', null);

  const { count: zipCount } = await supabase
    .from('calculated_metrics')
    .select('geography_id', { count: 'exact', head: true })
    .eq('geography_type', 'zip')
    .not('cap_rate', 'is', null);

  console.log('Cap Rate records (including all dates):');
  console.log('  Metro:', metroCount);
  console.log('  County:', countyCount);
  console.log('  ZIP:', zipCount);

  // Check ZORI coverage using count
  const { count: zoriCountyCount } = await supabase
    .from('zillow_county')
    .select('*', { count: 'exact', head: true })
    .eq('metric_name', 'zori');

  const { count: zoriZipCount } = await supabase
    .from('zillow_zip')
    .select('*', { count: 'exact', head: true })
    .eq('metric_name', 'zori');

  console.log('\nZORI (rent) records (time series):');
  console.log('  County ZORI records:', zoriCountyCount);
  console.log('  ZIP ZORI records:', zoriZipCount);

  // Check Realtor price coverage using count
  const { count: priceCountyCount } = await supabase
    .from('realtor_county')
    .select('*', { count: 'exact', head: true })
    .not('median_listing_price', 'is', null);

  const { count: priceZipCount } = await supabase
    .from('realtor_zip')
    .select('*', { count: 'exact', head: true })
    .not('median_listing_price', 'is', null);

  console.log('\nRealtor price records (time series):');
  console.log('  County price records:', priceCountyCount);
  console.log('  ZIP price records:', priceZipCount);

  // Get estimate of unique geographies with ZORI by checking distinct count on latest date
  const { data: latestZoriCounty } = await supabase
    .from('zillow_county')
    .select('period_date')
    .eq('metric_name', 'zori')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (latestZoriCounty) {
    const { count: latestCountyZori } = await supabase
      .from('zillow_county')
      .select('*', { count: 'exact', head: true })
      .eq('metric_name', 'zori')
      .eq('period_date', latestZoriCounty.period_date);

    console.log(`\nCounties with ZORI on ${latestZoriCounty.period_date}:`, latestCountyZori);
  }

  const { data: latestZoriZip } = await supabase
    .from('zillow_zip')
    .select('period_date')
    .eq('metric_name', 'zori')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (latestZoriZip) {
    const { count: latestZipZori } = await supabase
      .from('zillow_zip')
      .select('*', { count: 'exact', head: true })
      .eq('metric_name', 'zori')
      .eq('period_date', latestZoriZip.period_date);

    console.log(`ZIPs with ZORI on ${latestZoriZip.period_date}:`, latestZipZori);
  }
}

check().catch(console.error);
