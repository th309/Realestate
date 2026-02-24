/**
 * Shared constants, validation functions, and utility helpers
 * used across all calculated metric modules (investment, valuation, affordability).
 *
 * Single source of truth for thresholds, batch sizes, and data validation bounds.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EXPENSE_RATIO = 0.6;
export const PRICE_TO_INCOME_BENCHMARK = 3.5;
export const NATIONAL_MEDIAN_INCOME = 75000;
export const BATCH_SIZE = 100;

// Affordability constants
export const DOWN_PAYMENT_PCT = 0.20;
export const DEFAULT_MORTGAGE_RATE = 0.07;
export const MORTGAGE_TERM_MONTHS = 360;
export const PROPERTY_TAX_RATE = 0.011;
export const INSURANCE_RATE = 0.0035;
export const FRONT_END_DTI = 0.28;

// Years-to-save constants
export const SAVINGS_RATE = 0.10;
export const DOWN_PAYMENT_RATE = 0.20;

// FRED API
export const FRED_MORTGAGE_SERIES = 'MORTGAGE30US';

// Data validation bounds
export const MIN_VALID_PRICE = 10000;
export const MAX_VALID_PRICE = 50000000;
export const MIN_VALID_RENT = 100;
export const MAX_VALID_RENT = 15000;
export const MIN_VALID_CAP_RATE = 0.5;
export const MAX_VALID_CAP_RATE = 20;

// Pagination
export const PAGE_SIZE = 1000;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isValidRent(rent: number): boolean {
  return rent >= MIN_VALID_RENT && rent <= MAX_VALID_RENT;
}

export function isValidPrice(price: number): boolean {
  return price >= MIN_VALID_PRICE && price <= MAX_VALID_PRICE;
}

export function isValidCapRate(capRate: number): boolean {
  return capRate >= MIN_VALID_CAP_RATE && capRate <= MAX_VALID_CAP_RATE;
}

// ---------------------------------------------------------------------------
// Batch upsert helper (calculated_metrics table)
// ---------------------------------------------------------------------------

/**
 * Upsert records into calculated_metrics in batches of BATCH_SIZE.
 * Returns total stored count and any errors.
 */
export async function upsertCalculatedMetricsBatch(
  supabase: SupabaseClient,
  records: Record<string, unknown>[],
): Promise<{ stored: number; errors: string[] }> {
  const errors: string[] = [];
  let stored = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('calculated_metrics')
      .upsert(batch, { onConflict: 'geography_id,geography_type,period_date' });
    if (error) errors.push(error.message);
    else stored += batch.length;
  }

  return { stored, errors };
}

// ---------------------------------------------------------------------------
// Paginated fetch helper
// ---------------------------------------------------------------------------

/**
 * Fetch all rows from a Supabase table matching given filters, using pagination.
 * Returns the concatenated result array.
 */
export async function fetchAllPaginated(
  supabase: SupabaseClient,
  tableName: string,
  selectColumns: string,
  filters: Array<{ column: string; op: 'eq' | 'not' | 'gte' | 'lte'; value: unknown }>,
  orderBy?: { column: string; ascending: boolean },
): Promise<{ data: any[]; errors: string[] }> {
  const allData: any[] = [];
  const errors: string[] = [];
  let offset = 0;

  while (true) {
    let query = supabase.from(tableName).select(selectColumns);

    for (const f of filters) {
      if (f.op === 'eq') query = query.eq(f.column, f.value);
      else if (f.op === 'not') query = query.not(f.column, 'is', f.value);
      else if (f.op === 'gte') query = query.gte(f.column, f.value);
      else if (f.op === 'lte') query = query.lte(f.column, f.value);
    }

    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending });
    }

    query = query.range(offset, offset + PAGE_SIZE - 1);

    const { data, error } = await query;
    if (error) {
      errors.push(error.message);
      break;
    }
    if (!data || data.length === 0) break;

    allData.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }

  return { data: allData, errors };
}

// ---------------------------------------------------------------------------
// FRED mortgage rate fetch
// ---------------------------------------------------------------------------

export async function fetchMortgageRateFromFRED(): Promise<number> {
  const fredApiKey = process.env.FRED_API_KEY || '';
  if (!fredApiKey) {
    console.log('   No FRED_API_KEY, using default rate');
    return DEFAULT_MORTGAGE_RATE;
  }

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${FRED_MORTGAGE_SERIES}&api_key=${fredApiKey}&file_type=json&sort_order=desc&limit=1`;
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`   FRED API error: ${response.status}, using default rate`);
      return DEFAULT_MORTGAGE_RATE;
    }

    const data = await response.json();
    if (data.observations && data.observations.length > 0) {
      const latestRate = parseFloat(data.observations[0].value);
      if (!isNaN(latestRate)) {
        console.log(`   FRED mortgage rate: ${latestRate}% (${data.observations[0].date})`);
        return latestRate / 100;
      }
    }

    console.log('   No valid FRED data, using default rate');
    return DEFAULT_MORTGAGE_RATE;
  } catch {
    console.log('   FRED fetch failed, using default rate');
    return DEFAULT_MORTGAGE_RATE;
  }
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface MetricGroupResult {
  processed: number;
  stored: number;
  errors: string[];
  byGeo?: Record<string, { processed: number; stored: number }>;
}
