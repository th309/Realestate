/**
 * Calculate YoY for ZHVI by processing one year at a time
 * This avoids query timeouts on large datasets
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const geography = process.argv[2] || 'Metro';
const startYear = parseInt(process.argv[3] || '2001');  // 2001 is first year with YoY possible

async function processYear(year: number): Promise<number> {
  const BATCH_SIZE = 500;
  let totalUpdated = 0;
  let lastId = 0;
  let hasMore = true;

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  console.log(`  Processing ${year}...`);

  while (hasMore) {
    // Fetch batch of records for this year
    const { data: records, error } = await supabase
      .from('zillow_zhvi')
      .select('id, region_id, date, value, property_type, tier')
      .eq('geography', geography)
      .gte('date', startDate)
      .lte('date', endDate)
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      console.error(`    Error: ${error.message}`);
      break;
    }

    if (!records || records.length === 0) {
      hasMore = false;
      break;
    }

    lastId = records[records.length - 1].id;

    // Group lookups by previous date
    const dateGroups: Map<string, { region_id: string; property_type: string; tier: string }[]> = new Map();
    const recordMap: Map<string, any[]> = new Map();

    for (const record of records) {
      const prevDate = new Date(record.date);
      prevDate.setFullYear(prevDate.getFullYear() - 1);
      const prevDateStr = prevDate.toISOString().split('T')[0];

      if (!dateGroups.has(prevDateStr)) {
        dateGroups.set(prevDateStr, []);
      }
      dateGroups.get(prevDateStr)!.push({
        region_id: record.region_id,
        property_type: record.property_type,
        tier: record.tier
      });

      const key = `${record.region_id}|${record.property_type}|${record.tier}|${prevDateStr}`;
      if (!recordMap.has(key)) {
        recordMap.set(key, []);
      }
      recordMap.get(key)!.push(record);
    }

    // Fetch previous values
    const prevValueMap: Map<string, number> = new Map();

    for (const [date, lookups] of dateGroups) {
      const regionIds = [...new Set(lookups.map(l => l.region_id))];

      const { data: prevRecords } = await supabase
        .from('zillow_zhvi')
        .select('region_id, property_type, tier, value')
        .eq('geography', geography)
        .eq('date', date)
        .in('region_id', regionIds);

      if (prevRecords) {
        for (const prev of prevRecords) {
          const key = `${prev.region_id}|${prev.property_type}|${prev.tier}|${date}`;
          prevValueMap.set(key, prev.value);
        }
      }
    }

    // Calculate YoY and update
    const updates: { id: number; yoy_growth: number }[] = [];

    for (const record of records) {
      const prevDate = new Date(record.date);
      prevDate.setFullYear(prevDate.getFullYear() - 1);
      const prevDateStr = prevDate.toISOString().split('T')[0];
      const key = `${record.region_id}|${record.property_type}|${record.tier}|${prevDateStr}`;

      const prevValue = prevValueMap.get(key);
      if (prevValue && prevValue > 0 && record.value) {
        const yoyGrowth = ((record.value - prevValue) / prevValue) * 100;
        updates.push({
          id: record.id,
          yoy_growth: Math.round(yoyGrowth * 10000) / 10000
        });
      }
    }

    // Batch update
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100);
      await Promise.all(
        batch.map(update =>
          supabase
            .from('zillow_zhvi')
            .update({ yoy_growth: update.yoy_growth })
            .eq('id', update.id)
        )
      );
    }

    totalUpdated += updates.length;

    if (records.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log(`    ${year}: ${totalUpdated.toLocaleString()} records updated`);
  return totalUpdated;
}

async function main() {
  console.log('='.repeat(60));
  console.log(`  CALCULATE YoY GROWTH BY YEAR - ${geography}`);
  console.log('='.repeat(60));

  const currentYear = new Date().getFullYear();
  let total = 0;

  for (let year = startYear; year <= currentYear; year++) {
    const updated = await processYear(year);
    total += updated;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Complete! ${total.toLocaleString()} records updated`);
  console.log('='.repeat(60));
}

main().catch(console.error);
