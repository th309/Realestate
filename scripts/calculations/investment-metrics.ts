/**
 * Investment metric calculations: cap_rate, gross_yield, rent_to_price_ratio, grm.
 *
 * Joins ZORI (rent) from Zillow with median_listing_price from Realtor,
 * then computes investment ratios for each geography level.
 *
 * Exported runner: runInvestmentMetrics(supabase)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeZipKey } from '../utils/zip';
import {
  EXPENSE_RATIO,
  BATCH_SIZE,
  PAGE_SIZE,
  isValidRent,
  isValidPrice,
  isValidCapRate,
  type MetricGroupResult,
} from './metric-calculation-helpers';

// ---------------------------------------------------------------------------
// Pure calculation functions
// ---------------------------------------------------------------------------

function calculateCapRate(zori: number, price: number): number | null {
  if (!zori || !price || price === 0) return null;
  return (zori * 12 * EXPENSE_RATIO) / price * 100;
}

function calculateGrossYield(zori: number, price: number): number | null {
  if (!zori || !price || price === 0) return null;
  return (zori * 12) / price * 100;
}

function calculateRentToPriceRatio(zori: number, price: number): number | null {
  if (!zori || !price || price === 0) return null;
  return zori / price;
}

function calculateGRM(price: number, zori: number): number | null {
  if (!price || !zori || zori === 0) return null;
  return price / (zori * 12);
}

// ---------------------------------------------------------------------------
// Geography configs
// ---------------------------------------------------------------------------

interface InvestmentGeoConfig {
  zillowTable: string;
  realtorTable: string;
  geoType: 'metro' | 'county' | 'zip';
  zillowIdField: string;
  zillowNameField: string;
  realtorIdField: string;
}

const INVESTMENT_GEO_CONFIGS: InvestmentGeoConfig[] = [
  {
    zillowTable: 'zillow_metro',
    realtorTable: 'realtor_metro',
    geoType: 'metro',
    zillowIdField: 'cbsa_code',
    zillowNameField: 'region_name',
    realtorIdField: 'cbsa_code',
  },
  {
    zillowTable: 'zillow_county',
    realtorTable: 'realtor_county',
    geoType: 'county',
    zillowIdField: 'fips_code',
    zillowNameField: 'region_name',
    realtorIdField: 'county_fips',
  },
  {
    zillowTable: 'zillow_zip',
    realtorTable: 'realtor_zip',
    geoType: 'zip',
    zillowIdField: 'region_name',
    zillowNameField: 'region_name',
    realtorIdField: 'postal_code',
  },
];

// ---------------------------------------------------------------------------
// Per-geography calculation
// ---------------------------------------------------------------------------

async function calculateForGeo(
  supabase: SupabaseClient,
  config: InvestmentGeoConfig,
): Promise<{ processed: number; stored: number; errors: string[] }> {
  const errors: string[] = [];

  // Get latest ZORI date
  const { data: zoriDateRow } = await supabase
    .from(config.zillowTable)
    .select('period_date')
    .eq('metric_name', 'zori')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!zoriDateRow?.period_date) {
    return { processed: 0, stored: 0, errors: [`No ZORI data for ${config.geoType}`] };
  }

  const targetDate = zoriDateRow.period_date;

  // Fetch ZORI data (paginated)
  let zoriData: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(config.zillowTable)
      .select(`region_id, region_name, value, ${config.zillowIdField}`)
      .eq('metric_name', 'zori')
      .eq('period_date', targetDate)
      .not('value', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) { errors.push(error.message); break; }
    if (!data || data.length === 0) break;
    zoriData = zoriData.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }

  if (zoriData.length === 0) {
    return { processed: 0, stored: 0, errors: errors.length > 0 ? errors : [`No ZORI data for ${config.geoType}`] };
  }

  // Get latest Realtor date
  const { data: realtorDateRow } = await supabase
    .from(config.realtorTable)
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  const realtorDate = realtorDateRow?.period_date || targetDate;

  // Fetch Realtor prices (paginated)
  const priceByCode: Record<string, number> = {};
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(config.realtorTable)
      .select(`${config.realtorIdField}, median_listing_price`)
      .eq('period_date', realtorDate)
      .not('median_listing_price', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) { errors.push(error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data as any[]) {
      let id = row[config.realtorIdField];
      if (config.geoType === 'zip' && id) id = normalizeZipKey(String(id));
      if (id && row.median_listing_price) priceByCode[id] = row.median_listing_price;
    }
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }

  // Calculate and upsert
  let stored = 0;
  const records: any[] = [];

  for (const row of zoriData) {
    let geoId = row[config.zillowIdField];
    if (config.geoType === 'zip' && geoId) geoId = normalizeZipKey(String(geoId));
    const zori = row.value;
    const price = geoId ? priceByCode[geoId] : null;
    if (!zori || !price) continue;

    let geoName = row.region_name || row[config.zillowNameField];
    if (config.geoType === 'zip') geoName = geoName || `ZIP ${geoId}`;

    records.push({
      geography_id: geoId,
      geography_type: config.geoType,
      geography_name: geoName,
      period_date: targetDate,
      cap_rate: calculateCapRate(zori, price) ? Math.round(calculateCapRate(zori, price)! * 100) / 100 : null,
      gross_yield: calculateGrossYield(zori, price) ? Math.round(calculateGrossYield(zori, price)! * 100) / 100 : null,
      rent_to_price_ratio: calculateRentToPriceRatio(zori, price) ? Math.round(calculateRentToPriceRatio(zori, price)! * 10000) / 10000 : null,
      grm: calculateGRM(price, zori) ? Math.round(calculateGRM(price, zori)! * 100) / 100 : null,
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

  return { processed: zoriData.length, stored, errors };
}

// ---------------------------------------------------------------------------
// Public runner
// ---------------------------------------------------------------------------

export async function runInvestmentMetrics(
  supabase: SupabaseClient,
): Promise<MetricGroupResult> {
  const byGeo: Record<string, { processed: number; stored: number }> = {};
  let totalProcessed = 0;
  let totalStored = 0;
  const allErrors: string[] = [];

  for (const config of INVESTMENT_GEO_CONFIGS) {
    const result = await calculateForGeo(supabase, config);
    byGeo[config.geoType] = { processed: result.processed, stored: result.stored };
    totalProcessed += result.processed;
    totalStored += result.stored;
    allErrors.push(...result.errors);
  }

  return { processed: totalProcessed, stored: totalStored, errors: allErrors, byGeo };
}
