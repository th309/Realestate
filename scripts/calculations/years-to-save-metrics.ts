/**
 * Years-to-save metric calculation.
 *
 * Formula: (Median listing price x 0.20) / (Median Income x Savings Rate)
 * Joins Realtor listing prices with Census median household income
 * across all geography levels (national, state, metro, county, zip).
 *
 * Exported runner: runYearsToSaveMetrics(supabase)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeZipKey } from '../utils/zip';
import {
  BATCH_SIZE,
  PAGE_SIZE,
  SAVINGS_RATE,
  DOWN_PAYMENT_RATE,
} from './metric-calculation-helpers';
import { REALTOR_GEO_CONFIGS } from './affordability-metrics';

// ---------------------------------------------------------------------------
// Pure calculation
// ---------------------------------------------------------------------------

function calculateYearsToSave(price: number, income: number): number | null {
  if (!price || price === 0 || !income || income === 0) return null;
  const downPayment = price * DOWN_PAYMENT_RATE;
  const annualSavings = income * SAVINGS_RATE;
  return Math.round((downPayment / annualSavings) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Census table map for income lookup
// ---------------------------------------------------------------------------

const CENSUS_TABLE_MAP: Record<string, { tableName: string; idField: string }> = {
  national: { tableName: 'census_national', idField: 'id' },
  state: { tableName: 'census_state', idField: 'state_fips' },
  metro: { tableName: 'census_metro', idField: 'cbsa_code' },
  county: { tableName: 'census_county', idField: 'fips_code' },
  zip: { tableName: 'census_zip', idField: 'zcta' },
};

// ---------------------------------------------------------------------------
// Per-geography calculation
// ---------------------------------------------------------------------------

async function calculateForGeo(
  supabase: SupabaseClient,
  config: { tableName: string; geoType: string; idField: string; nameField: string },
): Promise<{ processed: number; stored: number; errors: string[] }> {
  const errors: string[] = [];
  const censusConfig = CENSUS_TABLE_MAP[config.geoType];

  // Latest Realtor date
  const { data: latestDateRow } = await supabase
    .from(config.tableName)
    .select('period_date')
    .not('median_listing_price', 'is', null)
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestDateRow?.period_date) {
    return { processed: 0, stored: 0, errors: [`No listing price data for ${config.geoType}`] };
  }
  const targetDate = latestDateRow.period_date;

  // Fetch Realtor listing prices (paginated)
  let realtorData: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(config.tableName)
      .select(`${config.idField}, ${config.nameField}, median_listing_price`)
      .eq('period_date', targetDate)
      .not('median_listing_price', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) { errors.push(error.message); break; }
    if (!data || data.length === 0) break;
    realtorData = realtorData.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }

  if (realtorData.length === 0) {
    return { processed: 0, stored: 0, errors: [`No Realtor data for ${config.geoType}`] };
  }

  // Fetch Census income (latest year per geo, paginated)
  const incomeByGeo: Record<string, number> = {};
  offset = 0;
  while (true) {
    const selectCols = config.geoType === 'national'
      ? 'year, median_household_income'
      : `${censusConfig.idField}, year, median_household_income`;
    const { data, error } = await supabase
      .from(censusConfig.tableName)
      .select(selectCols)
      .not('median_household_income', 'is', null)
      .order('year', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) { errors.push(error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data as any[]) {
      let geoId = config.geoType === 'national' ? 'US' : String(row[censusConfig.idField]);
      if (config.geoType === 'zip') geoId = normalizeZipKey(geoId);
      if (!incomeByGeo[geoId]) incomeByGeo[geoId] = Number(row.median_household_income);
    }
    offset += data.length;
    if (data.length < PAGE_SIZE) break;
  }

  // Calculate and batch upsert
  let stored = 0;
  const records: any[] = [];

  for (const row of realtorData) {
    let geoId: string, geoName: string;
    if (config.geoType === 'national') {
      geoId = 'US'; geoName = 'United States';
    } else if (config.geoType === 'zip') {
      geoId = normalizeZipKey(String(row[config.idField]));
      geoName = `ZIP ${geoId}`;
    } else if (config.geoType === 'state') {
      geoId = row[config.idField];
      geoName = row[config.nameField];
    } else {
      geoId = row[config.idField];
      geoName = row[config.nameField] || geoId;
    }

    const price = row.median_listing_price;
    const income = incomeByGeo[geoId] ?? incomeByGeo[row[config.idField]];
    if (!income) continue;

    const yearsToSave = calculateYearsToSave(price, income);
    if (yearsToSave === null) continue;

    records.push({
      geography_id: geoId,
      geography_type: config.geoType,
      geography_name: geoName,
      period_date: targetDate,
      years_to_save: yearsToSave,
      calculated_at: new Date().toISOString(),
    });

    if (records.length >= BATCH_SIZE) {
      const { error: upsertError } = await supabase
        .from('calculated_metrics')
        .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });
      if (upsertError) errors.push(upsertError.message);
      else stored += records.length;
      records.length = 0;
    }
  }

  if (records.length > 0) {
    const { error: upsertError } = await supabase
      .from('calculated_metrics')
      .upsert(records, { onConflict: 'geography_id,geography_type,period_date' });
    if (upsertError) errors.push(upsertError.message);
    else stored += records.length;
  }

  return { processed: realtorData.length, stored, errors };
}

// ---------------------------------------------------------------------------
// Public runner
// ---------------------------------------------------------------------------

type GeoResult = {
  total: { processed: number; stored: number };
  byGeo: Record<string, { processed: number; stored: number }>;
};

export async function runYearsToSaveMetrics(
  supabase: SupabaseClient,
): Promise<GeoResult> {
  const byGeo: Record<string, { processed: number; stored: number }> = {};
  let totalProcessed = 0, totalStored = 0;

  for (const config of REALTOR_GEO_CONFIGS) {
    const result = await calculateForGeo(supabase, config);
    byGeo[config.geoType] = { processed: result.processed, stored: result.stored };
    totalProcessed += result.processed;
    totalStored += result.stored;
  }

  return { total: { processed: totalProcessed, stored: totalStored }, byGeo };
}
