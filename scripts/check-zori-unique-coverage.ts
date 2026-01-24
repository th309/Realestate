import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function getUniqueGeos(table: string, idField: string, metricFilter?: { column: string; value: string }): Promise<Set<string>> {
  const ids = new Set<string>();
  const PAGE_SIZE = 1000;
  let offset = 0;

  while (true) {
    let query = supabase.from(table).select(idField);
    if (metricFilter) {
      query = query.eq(metricFilter.column, metricFilter.value);
    }
    query = query.not(idField, 'is', null);
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error(`Error fetching from ${table}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;

    data.forEach((r: Record<string, unknown>) => {
      const val = r[idField];
      if (val) ids.add(String(val));
    });

    if (data.length < PAGE_SIZE) break;
    offset += data.length;
    if (offset % 50000 === 0) console.log(`  Fetched ${offset} records from ${table}...`);
  }

  return ids;
}

async function check() {
  console.log('Checking unique geography coverage across ALL dates...\n');

  console.log('Fetching unique counties with ZORI data (all dates)...');
  const zoriCounties = await getUniqueGeos('zillow_county', 'fips_code', { column: 'metric_name', value: 'zori' });
  console.log(`  Unique counties with ZORI: ${zoriCounties.size}`);

  console.log('\nFetching unique ZIPs with ZORI data (all dates)...');
  const zoriZips = await getUniqueGeos('zillow_zip', 'region_name', { column: 'metric_name', value: 'zori' });
  console.log(`  Unique ZIPs with ZORI: ${zoriZips.size}`);

  console.log('\nFetching unique metros with ZORI data (all dates)...');
  const zoriMetros = await getUniqueGeos('zillow_metro', 'cbsa_code', { column: 'metric_name', value: 'zori' });
  console.log(`  Unique metros with ZORI: ${zoriMetros.size}`);

  console.log('\n--- Realtor Price Coverage (for comparison) ---');

  console.log('\nFetching unique counties with Realtor price data...');
  const priceCounties = await getUniqueGeos('realtor_county', 'county_fips');
  console.log(`  Unique counties with price data: ${priceCounties.size}`);

  console.log('\nFetching unique ZIPs with Realtor price data...');
  const priceZips = await getUniqueGeos('realtor_zip', 'postal_code');
  console.log(`  Unique ZIPs with price data: ${priceZips.size}`);

  console.log('\nFetching unique metros with Realtor price data...');
  const priceMetros = await getUniqueGeos('realtor_metro', 'cbsa_code');
  console.log(`  Unique metros with price data: ${priceMetros.size}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\nZORI (rent) coverage - this is the LIMITING factor for cap_rate:');
  console.log(`  Metros:   ${zoriMetros.size}`);
  console.log(`  Counties: ${zoriCounties.size}`);
  console.log(`  ZIPs:     ${zoriZips.size}`);

  console.log('\nRealtor price coverage (much broader):');
  console.log(`  Metros:   ${priceMetros.size}`);
  console.log(`  Counties: ${priceCounties.size}`);
  console.log(`  ZIPs:     ${priceZips.size}`);

  console.log('\nPotential cap_rate coverage (intersection):');

  const metroIntersection = [...zoriMetros].filter(id => priceMetros.has(id));
  const countyIntersection = [...zoriCounties].filter(id => priceCounties.has(id));
  const zipIntersection = [...zoriZips].filter(id => priceZips.has(id));

  console.log(`  Metros:   ${metroIntersection.length}`);
  console.log(`  Counties: ${countyIntersection.length}`);
  console.log(`  ZIPs:     ${zipIntersection.length}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
}

check().catch(console.error);
