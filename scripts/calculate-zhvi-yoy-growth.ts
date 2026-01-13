/**
 * Calculate Year-over-Year Growth for ZHVI Table
 *
 * This script calculates the YoY percentage growth for each record in zillow_zhvi
 * by comparing to the value from 12 months ago.
 *
 * Formula: ((current_value - previous_value) / previous_value) * 100
 *
 * Usage:
 *   npx tsx scripts/calculate-zhvi-yoy-growth.ts
 *   npx tsx scripts/calculate-zhvi-yoy-growth.ts --geography=Metro
 *   npx tsx scripts/calculate-zhvi-yoy-growth.ts --since=2024-01-01
 *   npx tsx scripts/calculate-zhvi-yoy-growth.ts --add-column-only
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });
config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg?.split('=')[1];
};
const hasFlag = (name: string): boolean => args.includes(`--${name}`);

const geographyFilter = getArg('geography');
const sinceDate = getArg('since');
const addColumnOnly = hasFlag('add-column-only');
const forceRecalculate = hasFlag('force'); // Skip null check, recalculate all

/**
 * Ensure the yoy_growth column exists
 */
async function ensureColumnExists(): Promise<boolean> {
  // Try to select yoy_growth - if it fails, column doesn't exist
  const { error } = await supabase
    .from('zillow_zhvi')
    .select('yoy_growth')
    .limit(1);

  if (error && error.message.includes('yoy_growth')) {
    console.log('Column yoy_growth does not exist. Please run this SQL in Supabase:');
    console.log(`
ALTER TABLE zillow_zhvi
ADD COLUMN IF NOT EXISTS yoy_growth DECIMAL(10, 4);

CREATE INDEX IF NOT EXISTS idx_zillow_zhvi_yoy_lookup
ON zillow_zhvi(region_id, property_type, tier, geography, date);

COMMENT ON COLUMN zillow_zhvi.yoy_growth IS 'Year-over-year percentage growth compared to same month 12 months prior';
    `);
    return false;
  }

  console.log('✅ Column yoy_growth exists');
  return true;
}

async function calculateYoYGrowth() {
  console.log('='.repeat(60));
  console.log('  CALCULATE ZHVI YEAR-OVER-YEAR GROWTH');
  console.log('='.repeat(60));
  console.log();

  // Check if column exists
  const columnExists = await ensureColumnExists();
  if (!columnExists) {
    console.log('\n❌ Please add the column first, then re-run this script.');
    process.exit(1);
  }

  if (addColumnOnly) {
    console.log('--add-column-only flag set, exiting after column check.');
    return;
  }

  if (geographyFilter) {
    console.log(`Geography filter: ${geographyFilter}`);
  }
  if (sinceDate) {
    console.log(`Processing records since: ${sinceDate}`);
  }

  // Process by geography from smallest to largest
  const geographies = geographyFilter
    ? [geographyFilter]
    : ['State', 'Metro', 'County', 'City', 'Zip'];

  let totalUpdated = 0;
  const startTime = Date.now();

  for (const geography of geographies) {
    console.log(`\nProcessing ${geography}...`);
    const updated = await batchCalculateYoY(geography, sinceDate);
    totalUpdated += updated;
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Complete! ${totalUpdated.toLocaleString()} records updated with YoY growth`);
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log('='.repeat(60));
}

/**
 * Efficient batch calculate YoY growth
 * Uses bulk lookups instead of individual queries
 */
async function batchCalculateYoY(geography: string, since?: string): Promise<number> {
  const BATCH_SIZE = 500; // Records to fetch at a time
  const UPDATE_BATCH_SIZE = 100; // Records to update at a time
  let totalUpdated = 0;
  let hasMore = true;
  let lastId = 0;

  // Skip count query - it times out on large datasets
  // Just process until no more records
  console.log(`  Processing records${forceRecalculate ? ' (force mode)' : ''}...`);

  while (hasMore) {
    // Fetch batch of records
    // In force mode, don't filter by yoy_growth (schema cache issues)
    // We'll check the value client-side instead
    const selectCols = forceRecalculate
      ? 'id, region_id, date, value, property_type, tier'
      : 'id, region_id, date, value, property_type, tier, yoy_growth';

    let query = supabase
      .from('zillow_zhvi')
      .select(selectCols)
      .eq('geography', geography)
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (!forceRecalculate) {
      query = query.is('yoy_growth', null);
    }

    if (since) {
      query = query.gte('date', since);
    }

    const { data: records, error } = await query;

    if (error) {
      console.error(`  Error fetching records: ${error.message}`);
      break;
    }

    if (!records || records.length === 0) {
      hasMore = false;
      break;
    }

    lastId = records[records.length - 1].id;

    // Build a map of what previous dates we need
    const previousDates: Map<string, { date: string; records: typeof records }> = new Map();

    for (const record of records) {
      const previousDate = new Date(record.date);
      previousDate.setFullYear(previousDate.getFullYear() - 1);
      const prevDateStr = previousDate.toISOString().split('T')[0];

      const key = `${record.region_id}|${record.property_type}|${record.tier}|${prevDateStr}`;
      if (!previousDates.has(key)) {
        previousDates.set(key, { date: prevDateStr, records: [] });
      }
      previousDates.get(key)!.records.push(record);
    }

    // Fetch all previous values in batches
    const prevValueMap: Map<string, number> = new Map();
    const dateKeys = Array.from(previousDates.keys());

    // Group by date for more efficient queries
    const dateGroups: Map<string, { region_id: string; property_type: string; tier: string }[]> = new Map();
    for (const [key, info] of previousDates) {
      const [region_id, property_type, tier, date] = key.split('|');
      if (!dateGroups.has(date)) {
        dateGroups.set(date, []);
      }
      dateGroups.get(date)!.push({ region_id, property_type, tier });
    }

    // Fetch previous values by date (more efficient)
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

    // Calculate YoY and prepare updates
    const updates: { id: number; yoy_growth: number }[] = [];

    for (const record of records as any[]) {
      // In non-force mode, we only fetch records with null yoy_growth
      // In force mode, we fetch all records but skip ones that already have yoy_growth
      // (Note: in force mode, yoy_growth isn't selected so we calculate for all)

      const previousDate = new Date(record.date);
      previousDate.setFullYear(previousDate.getFullYear() - 1);
      const prevDateStr = previousDate.toISOString().split('T')[0];
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
    for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
      const batch = updates.slice(i, i + UPDATE_BATCH_SIZE);

      // Use individual updates (Supabase doesn't support bulk update with different values)
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
    process.stdout.write(`  Updated: ${totalUpdated.toLocaleString()} records...\r`);

    if (records.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log(`  ✅ ${geography}: ${totalUpdated.toLocaleString()} records updated                    `);
  return totalUpdated;
}

// Also export a function that can be called from the import script
export async function updateYoYGrowthForDate(date: string): Promise<number> {
  // For a specific date, we can be more targeted
  const previousDate = new Date(date);
  previousDate.setFullYear(previousDate.getFullYear() - 1);
  const prevDateStr = previousDate.toISOString().split('T')[0];

  // Get records for this date
  const { data: records } = await supabase
    .from('zillow_zhvi')
    .select('id, region_id, property_type, tier, geography, value')
    .eq('date', date);

  if (!records || records.length === 0) return 0;

  let updated = 0;
  for (const record of records) {
    const { data: prev } = await supabase
      .from('zillow_zhvi')
      .select('value')
      .eq('region_id', record.region_id)
      .eq('property_type', record.property_type)
      .eq('tier', record.tier)
      .eq('geography', record.geography)
      .eq('date', prevDateStr)
      .single();

    if (prev && prev.value > 0) {
      const yoyGrowth = ((record.value - prev.value) / prev.value) * 100;
      await supabase
        .from('zillow_zhvi')
        .update({ yoy_growth: Math.round(yoyGrowth * 10000) / 10000 })
        .eq('id', record.id);
      updated++;
    }
  }

  return updated;
}

calculateYoYGrowth().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
