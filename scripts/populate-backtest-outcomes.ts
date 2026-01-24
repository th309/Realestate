/**
 * Populate Backtest Outcomes
 *
 * Joins historical PropertyIQ scores with Zillow ZHVI data to calculate
 * actual appreciation outcomes for backtesting validation.
 *
 * For each historical score:
 * - Look up ZHVI at score date (starting value)
 * - Look up ZHVI at future dates (12m, 24m, 36m, 60m, 120m later)
 * - Calculate actual appreciation: (future - past) / past
 * - Store outcomes for correlation analysis
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Horizon configurations (months)
// Latest Zillow data is ~2025-12, so we can only compute outcomes for older periods
// For 12m outcomes: period must be <= 2024-12 (so we have 2025-12 outcome data)
const HORIZONS = [12, 24, 36, 60, 120];

// Cutoff date - only process periods older than this (need ~12 months of future data)
const OUTCOME_CUTOFF = '2024-12-01';

interface ZillowConfig {
  table: string;
  idColumn: string;
}

const ZILLOW_CONFIGS: Record<string, ZillowConfig> = {
  state: { table: 'zillow_state', idColumn: 'state_code' },
  metro: { table: 'zillow_metro', idColumn: 'cbsa_code' },
  county: { table: 'zillow_county', idColumn: 'fips_code' },
  zip: { table: 'zillow_zip', idColumn: 'region_name' },
};

// Add months to a date string (YYYY-MM-DD format)
function addMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
}

// Get ZHVI value for a target period
// History uses first of month (2025-11-01), Zillow uses end of month (2025-11-30)
async function getZHVI(
  geoType: string,
  geoId: string,
  targetDate: string
): Promise<number | null> {
  const config = ZILLOW_CONFIGS[geoType];
  if (!config) return null;

  // Convert first-of-month to same month range
  // targetDate is like "2025-11-01", we want any date in November 2025
  const targetYear = targetDate.substring(0, 4);
  const targetMonth = targetDate.substring(5, 7);

  // Range for the entire month
  const monthStart = `${targetYear}-${targetMonth}-01`;
  const monthEnd = `${targetYear}-${targetMonth}-31`; // Works even for shorter months

  const { data } = await supabase
    .from(config.table)
    .select('value')
    .eq(config.idColumn, geoId)
    .eq('metric_name', 'zhvi')
    .gte('period_date', monthStart)
    .lte('period_date', monthEnd)
    .limit(1);

  if (data && data[0]?.value) {
    return data[0].value;
  }

  // If not found, try previous month (data might be delayed)
  const prevMonthDate = addMonths(targetDate, -1);
  const prevYear = prevMonthDate.substring(0, 4);
  const prevMonth = prevMonthDate.substring(5, 7);
  const prevStart = `${prevYear}-${prevMonth}-01`;
  const prevEnd = `${prevYear}-${prevMonth}-31`;

  const { data: prevData } = await supabase
    .from(config.table)
    .select('value')
    .eq(config.idColumn, geoId)
    .eq('metric_name', 'zhvi')
    .gte('period_date', prevStart)
    .lte('period_date', prevEnd)
    .limit(1);

  return prevData?.[0]?.value ?? null;
}

// Calculate appreciation between two ZHVI values
function calculateAppreciation(start: number | null, end: number | null): number | null {
  if (start == null || end == null || start === 0) return null;
  return (end - start) / start;
}

// Process a batch of history records
async function processBatch(
  records: any[],
  geoType: string
): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  let skipped = 0;

  // Pre-fetch all needed dates for this batch
  const updates: any[] = [];

  for (const record of records) {
    const scoreDate = record.period_date;
    const geoId = record.geography_id;

    // Get starting ZHVI
    const startZHVI = await getZHVI(geoType, geoId, scoreDate);
    if (startZHVI == null) {
      skipped++;
      continue;
    }

    // Calculate outcomes for each horizon
    const outcomes: any = {
      outcomes_updated_at: new Date().toISOString(),
    };

    for (const months of HORIZONS) {
      const futureDate = addMonths(scoreDate, months);
      const futureZHVI = await getZHVI(geoType, geoId, futureDate);
      const appreciation = calculateAppreciation(startZHVI, futureZHVI);

      if (appreciation != null) {
        const colName = `actual_appreciation_${months}m`;
        outcomes[colName] = Math.round(appreciation * 1000) / 1000; // 3 decimal places
      }
    }

    // Only update if we have at least one outcome
    if (Object.keys(outcomes).length > 1) {
      updates.push({
        id: record.id,
        ...outcomes,
      });
      updated++;
    } else {
      skipped++;
    }
  }

  // Batch update
  if (updates.length > 0) {
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100);
      for (const update of batch) {
        const { id, ...data } = update;
        await supabase
          .from('propertyiq_scores_history')
          .update(data)
          .eq('id', id);
      }
    }
  }

  return { updated, skipped };
}

// Get distinct score dates for a geography type (only dates old enough to have outcomes)
async function getScoreDates(geoType: string): Promise<string[]> {
  const allDates: string[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from('propertyiq_scores_history')
      .select('period_date')
      .eq('geography_type', geoType)
      .lte('period_date', OUTCOME_CUTOFF) // Only periods with available outcome data
      .order('period_date', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (data && data.length > 0) {
      allDates.push(...data.map(d => d.period_date));
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return [...new Set(allDates)].sort((a, b) => b.localeCompare(a));
}

// Process all records for a geography type and period
async function processGeoTypePeriod(
  geoType: string,
  periodDate: string
): Promise<{ updated: number; skipped: number }> {
  const pageSize = 500;
  let offset = 0;
  let hasMore = true;
  let totalUpdated = 0;
  let totalSkipped = 0;

  while (hasMore) {
    const { data: records, error } = await supabase
      .from('propertyiq_scores_history')
      .select('id, geography_id, period_date')
      .eq('geography_type', geoType)
      .eq('period_date', periodDate)
      .lte('period_date', OUTCOME_CUTOFF)
      .is('actual_appreciation_12m', null) // Only process records without outcomes
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(`  Error fetching records: ${error.message}`);
      break;
    }

    if (records && records.length > 0) {
      const result = await processBatch(records, geoType);
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      offset += pageSize;
      hasMore = records.length === pageSize;

      // Progress indicator
      process.stdout.write('.');
    } else {
      hasMore = false;
    }
  }

  return { updated: totalUpdated, skipped: totalSkipped };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  BACKTEST OUTCOME POPULATION                                  ║');
  console.log('║  Joining scores with actual Zillow ZHVI appreciation          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const geoTypes = ['state', 'metro', 'county', 'zip'];
  let grandTotalUpdated = 0;
  let grandTotalSkipped = 0;

  for (const geoType of geoTypes) {
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`  Processing ${geoType.toUpperCase()} geographies`);
    console.log(`═══════════════════════════════════════════════════════════════`);

    // Get all score dates for this geo type
    const dates = await getScoreDates(geoType);
    console.log(`  Found ${dates.length} date periods`);

    if (dates.length === 0) continue;

    let geoUpdated = 0;
    let geoSkipped = 0;

    // Process each date period
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      process.stdout.write(`  ${i + 1}/${dates.length} ${date}: `);

      const startTime = Date.now();
      const result = await processGeoTypePeriod(geoType, date);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      geoUpdated += result.updated;
      geoSkipped += result.skipped;

      console.log(` ${result.updated} updated, ${result.skipped} skipped (${elapsed}s)`);
    }

    console.log(`\n  ${geoType} totals: ${geoUpdated} updated, ${geoSkipped} skipped`);
    grandTotalUpdated += geoUpdated;
    grandTotalSkipped += geoSkipped;
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`  Total records updated: ${grandTotalUpdated.toLocaleString()}`);
  console.log(`  Total records skipped: ${grandTotalSkipped.toLocaleString()}`);

  // Sample verification
  console.log('\n  Sample outcomes (top 5 by InvestorEdge score):');
  const { data: samples } = await supabase
    .from('propertyiq_scores_history')
    .select('geography_id, geography_type, period_date, investoredge_score, actual_appreciation_12m, actual_appreciation_36m')
    .not('actual_appreciation_12m', 'is', null)
    .order('investoredge_score', { ascending: false })
    .limit(5);

  if (samples) {
    for (const s of samples) {
      const appr12m = s.actual_appreciation_12m != null ? `${(s.actual_appreciation_12m * 100).toFixed(1)}%` : 'N/A';
      const appr36m = s.actual_appreciation_36m != null ? `${(s.actual_appreciation_36m * 100).toFixed(1)}%` : 'N/A';
      console.log(`    ${s.geography_id} (${s.geography_type}) - Score: ${s.investoredge_score}, 1yr: ${appr12m}, 3yr: ${appr36m}`);
    }
  }

  console.log('\n✓ Outcome population complete');
}

main().catch(console.error);
