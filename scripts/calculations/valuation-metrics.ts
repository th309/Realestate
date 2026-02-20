/**
 * Valuation metric calculations: overvalued_pct and home_value_5yr_cagr.
 *
 * overvalued_pct: Compares ZHVI home values to Census median income
 *   using the price-to-income benchmark ratio.
 *
 * 5yr growth: Compares current vs. 5-year-ago median listing price
 *   for metros and states.
 *
 * Exported runner: runValuationMetrics(supabase)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PRICE_TO_INCOME_BENCHMARK,
  NATIONAL_MEDIAN_INCOME,
  BATCH_SIZE,
  type MetricGroupResult,
} from './metric-calculation-helpers';

// ---------------------------------------------------------------------------
// Pure calculation
// ---------------------------------------------------------------------------

function calculateOvervalued(price: number, income: number): number | null {
  if (!price || !income || income === 0) return null;
  const priceToIncome = price / income;
  return ((priceToIncome - PRICE_TO_INCOME_BENCHMARK) / PRICE_TO_INCOME_BENCHMARK) * 100;
}

// ---------------------------------------------------------------------------
// Overvalued percentage (metros only)
// ---------------------------------------------------------------------------

async function calculateOvervaluedMetrics(
  supabase: SupabaseClient,
): Promise<MetricGroupResult> {
  const errors: string[] = [];

  const { data: zhviDateRow } = await supabase
    .from('zillow_metro')
    .select('period_date')
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!zhviDateRow?.period_date) {
    return { processed: 0, stored: 0, errors: ['No ZHVI data available'] };
  }

  const targetDate = zhviDateRow.period_date;

  const { data: zhviData, error: zhviError } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, value, cbsa_code')
    .eq('metric_name', 'zhvi')
    .eq('period_date', targetDate)
    .not('value', 'is', null);

  if (zhviError || !zhviData) {
    return { processed: 0, stored: 0, errors: [zhviError?.message || 'Failed to fetch ZHVI'] };
  }

  // Census income lookup
  const { data: incomeData } = await supabase
    .from('census_metro')
    .select('cbsa_code, median_household_income, year')
    .not('median_household_income', 'is', null)
    .order('year', { ascending: false });

  const incomeByGeo: Record<string, number> = {};
  if (incomeData) {
    for (const row of incomeData) {
      if (row.median_household_income && !incomeByGeo[row.cbsa_code]) {
        incomeByGeo[row.cbsa_code] = Number(row.median_household_income);
      }
    }
  }

  let stored = 0;
  const records: any[] = [];

  for (const metro of zhviData) {
    const cbsaCode = metro.cbsa_code;
    if (!cbsaCode) continue;

    const zhvi = metro.value;
    const medianIncome = incomeByGeo[cbsaCode] || NATIONAL_MEDIAN_INCOME;
    const overvaluedPct = calculateOvervalued(zhvi, medianIncome);
    if (overvaluedPct === null) continue;

    records.push({
      geography_id: cbsaCode,
      geography_type: 'metro',
      geography_name: metro.region_name,
      period_date: targetDate,
      overvalued_pct: Math.round(overvaluedPct * 10) / 10,
      calculated_at: new Date().toISOString(),
    });

    if (records.length >= BATCH_SIZE) {
      const { error } = await supabase
        .from('calculated_metrics')
        .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });
      if (error) errors.push(error.message);
      else stored += records.length;
      records.length = 0;
    }
  }

  if (records.length > 0) {
    const { error } = await supabase
      .from('calculated_metrics')
      .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });
    if (error) errors.push(error.message);
    else stored += records.length;
  }

  return { processed: zhviData.length, stored, errors };
}

// ---------------------------------------------------------------------------
// 5-year growth (metro + state)
// ---------------------------------------------------------------------------

async function calculate5YrGrowth(
  supabase: SupabaseClient,
  geoType: 'metro' | 'state',
): Promise<{ processed: number; stored: number }> {
  const tableName = geoType === 'metro' ? 'realtor_metro' : 'realtor_state';
  const idField = geoType === 'metro' ? 'cbsa_code' : 'state_id';
  const nameField = geoType === 'metro' ? 'cbsa_title' : 'state_name';

  const { data: latestDateRow } = await supabase
    .from(tableName)
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestDateRow?.period_date) return { processed: 0, stored: 0 };

  const targetDate = latestDateRow.period_date;
  const fiveYearsAgo = new Date(targetDate);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];
  const pastDateMax = new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: currentData } = await supabase
    .from(tableName)
    .select(`${idField}, ${nameField}, median_listing_price`)
    .eq('period_date', targetDate)
    .not('median_listing_price', 'is', null);

  if (!currentData || currentData.length === 0) return { processed: 0, stored: 0 };

  const { data: pastData } = await supabase
    .from(tableName)
    .select(`${idField}, median_listing_price`)
    .gte('period_date', pastDateStr)
    .lte('period_date', pastDateMax)
    .not('median_listing_price', 'is', null)
    .order('period_date', { ascending: true });

  const pastByRegion: Record<string, number> = {};
  if (pastData) {
    for (const row of pastData as any[]) {
      const id = row[idField];
      if (!pastByRegion[id]) pastByRegion[id] = row.median_listing_price;
    }
  }

  let stored = 0;
  for (const item of currentData as any[]) {
    const id = item[idField];
    const pastValue = pastByRegion[id];
    if (!pastValue || pastValue === 0) continue;

    const growthPct = ((item.median_listing_price - pastValue) / pastValue) * 100;

    const { error } = await supabase
      .from('calculated_metrics')
      .upsert({
        geography_id: id,
        geography_type: geoType,
        geography_name: item[nameField],
        period_date: targetDate,
        home_value_5yr_cagr: Math.round(growthPct * 100) / 100,
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'geography_id,geography_type,period_date' });

    if (!error) stored++;
  }

  return { processed: currentData.length, stored };
}

// ---------------------------------------------------------------------------
// Public runner
// ---------------------------------------------------------------------------

export async function runValuationMetrics(
  supabase: SupabaseClient,
): Promise<{
  overvalued: MetricGroupResult;
  growth5YrMetros: { processed: number; stored: number };
  growth5YrStates: { processed: number; stored: number };
}> {
  const [overvalued, growth5YrMetros, growth5YrStates] = await Promise.all([
    calculateOvervaluedMetrics(supabase),
    calculate5YrGrowth(supabase, 'metro'),
    calculate5YrGrowth(supabase, 'state'),
  ]);

  return { overvalued, growth5YrMetros, growth5YrStates };
}
