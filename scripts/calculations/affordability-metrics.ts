/**
 * Affordability metric calculations: income_to_buy and affordable_home_price.
 *
 * income_to_buy: Annual income needed to afford a home purchase (PITI / 28% DTI).
 * affordable_home_price: Max affordable price given local median income.
 *
 * Exported runner: runAffordabilityMetrics(supabase)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeZipKey } from '../utils/zip';
import {
  BATCH_SIZE,
  PAGE_SIZE,
  DOWN_PAYMENT_PCT,
  MORTGAGE_TERM_MONTHS,
  PROPERTY_TAX_RATE,
  INSURANCE_RATE,
  FRONT_END_DTI,
  fetchMortgageRateFromFRED,
} from './metric-calculation-helpers';

// ---------------------------------------------------------------------------
// Pure calculation functions
// ---------------------------------------------------------------------------

export function calculateIncomeToBuy(price: number, mortgageRate: number): number | null {
  if (!price || price === 0) return null;

  const loanAmount = price * (1 - DOWN_PAYMENT_PCT);
  const monthlyRate = mortgageRate / 12;
  const factor = Math.pow(1 + monthlyRate, MORTGAGE_TERM_MONTHS);
  const monthlyMortgage = loanAmount * (monthlyRate * factor) / (factor - 1);
  const monthlyTaxes = (price * PROPERTY_TAX_RATE) / 12;
  const monthlyInsurance = (price * INSURANCE_RATE) / 12;
  const monthlyPITI = monthlyMortgage + monthlyTaxes + monthlyInsurance;
  const annualIncome = (monthlyPITI * 12) / FRONT_END_DTI;

  return Math.round(annualIncome);
}

export function calculateAffordableHomePrice(annualIncome: number, mortgageRate: number): number | null {
  if (!annualIncome || annualIncome === 0) return null;

  const monthlyRate = mortgageRate / 12;
  const factor = Math.pow(1 + monthlyRate, MORTGAGE_TERM_MONTHS);
  const pmtFactor = (monthlyRate * factor) / (factor - 1);
  const maxMonthlyPITI = (annualIncome * FRONT_END_DTI) / 12;
  const taxInsuranceMonthlyRate = (PROPERTY_TAX_RATE + INSURANCE_RATE) / 12;
  const denominator = (1 - DOWN_PAYMENT_PCT) * pmtFactor + taxInsuranceMonthlyRate;
  const homePrice = maxMonthlyPITI / denominator;

  return Math.round(homePrice);
}

// ---------------------------------------------------------------------------
// Geography configs
// ---------------------------------------------------------------------------

interface RealtorGeoConfig {
  tableName: string;
  geoType: string;
  idField: string;
  nameField: string;
}

export const REALTOR_GEO_CONFIGS: RealtorGeoConfig[] = [
  { tableName: 'realtor_national', geoType: 'national', idField: 'region_id', nameField: 'region_name' },
  { tableName: 'realtor_state', geoType: 'state', idField: 'state_id', nameField: 'state_name' },
  { tableName: 'realtor_metro', geoType: 'metro', idField: 'cbsa_code', nameField: 'cbsa_title' },
  { tableName: 'realtor_county', geoType: 'county', idField: 'county_fips', nameField: 'county_name' },
  { tableName: 'realtor_zip', geoType: 'zip', idField: 'postal_code', nameField: 'postal_code' },
];

interface CensusIncomeConfig {
  tableName: string;
  geoType: string;
  idField: string;
  nameField: string;
}

const CENSUS_INCOME_CONFIGS: CensusIncomeConfig[] = [
  { tableName: 'census_national', geoType: 'national', idField: "'US'", nameField: "'United States'" },
  { tableName: 'census_state', geoType: 'state', idField: 'state_fips', nameField: 'state_name' },
  { tableName: 'census_metro', geoType: 'metro', idField: 'cbsa_code', nameField: 'cbsa_title' },
  { tableName: 'census_county', geoType: 'county', idField: 'fips_code', nameField: 'county_name' },
  { tableName: 'census_zip', geoType: 'zip', idField: 'zcta', nameField: 'zcta' },
];

// ---------------------------------------------------------------------------
// Batch upsert helper (local)
// ---------------------------------------------------------------------------

async function batchUpsertRecords(
  supabase: SupabaseClient,
  records: any[],
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
// Income-to-buy (all geographies)
// ---------------------------------------------------------------------------

async function calculateIncomeToBuyForGeo(
  supabase: SupabaseClient,
  config: RealtorGeoConfig,
  mortgageRate: number,
): Promise<{ processed: number; stored: number; errors: string[] }> {
  const errors: string[] = [];

  const { data: latestRow } = await supabase
    .from(config.tableName).select('period_date')
    .order('period_date', { ascending: false }).limit(1).single();

  if (!latestRow?.period_date) {
    return { processed: 0, stored: 0, errors: [`No data in ${config.tableName}`] };
  }
  const targetDate = latestRow.period_date;

  let allData: any[] = [];
  let offset = 0;
  while (true) {
    const selectCols = config.geoType === 'national'
      ? 'median_listing_price'
      : `${config.idField}, ${config.nameField}, median_listing_price`;
    const { data, error } = await supabase
      .from(config.tableName).select(selectCols)
      .eq('period_date', targetDate).not('median_listing_price', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) { errors.push(error.message); break; }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }

  if (allData.length === 0) {
    return { processed: 0, stored: 0, errors: errors.length > 0 ? errors : [`No data for ${config.tableName}`] };
  }

  const records: any[] = [];
  for (const row of allData) {
    const incomeToBuy = calculateIncomeToBuy(row.median_listing_price, mortgageRate);
    if (incomeToBuy === null) continue;

    let geoId: string, geoName: string;
    if (config.geoType === 'national') { geoId = 'US'; geoName = 'United States'; }
    else {
      geoId = String(row[config.idField]);
      if (config.geoType === 'zip') geoId = normalizeZipKey(geoId);
      geoName = row[config.nameField] || geoId;
    }

    records.push({
      geography_id: geoId, geography_type: config.geoType, geography_name: geoName,
      period_date: targetDate, income_to_buy: incomeToBuy, calculated_at: new Date().toISOString(),
    });
  }

  const { stored, errors: upsertErrors } = await batchUpsertRecords(supabase, records);
  return { processed: allData.length, stored, errors: [...errors, ...upsertErrors] };
}

// ---------------------------------------------------------------------------
// Affordable home price (all geographies)
// ---------------------------------------------------------------------------

async function calculateAffordableHomePriceForGeo(
  supabase: SupabaseClient,
  config: CensusIncomeConfig,
  mortgageRate: number,
): Promise<{ processed: number; stored: number; errors: string[] }> {
  const errors: string[] = [];

  let allData: any[] = [];
  let offset = 0;
  while (true) {
    const selectCols = config.geoType === 'national'
      ? 'year, median_household_income'
      : `${config.idField}, ${config.nameField}, year, median_household_income`;
    const { data, error } = await supabase
      .from(config.tableName).select(selectCols)
      .not('median_household_income', 'is', null)
      .order('year', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) { errors.push(error.message); break; }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }

  if (allData.length === 0) {
    return { processed: 0, stored: 0, errors: errors.length > 0 ? errors : [`No income data for ${config.tableName}`] };
  }

  const latestByGeo: Record<string, any> = {};
  for (const row of allData) {
    const geoId = config.geoType === 'national' ? 'US' : String(row[config.idField]);
    if (!latestByGeo[geoId]) latestByGeo[geoId] = row;
  }

  const { data: latestDateRow } = await supabase
    .from('realtor_metro').select('period_date')
    .order('period_date', { ascending: false }).limit(1).single();
  const targetDate = latestDateRow?.period_date || new Date().toISOString().split('T')[0];

  const records: any[] = [];
  for (const [geoId, row] of Object.entries(latestByGeo)) {
    const affordablePrice = calculateAffordableHomePrice((row as any).median_household_income, mortgageRate);
    if (affordablePrice === null) continue;

    const finalGeoId = config.geoType === 'zip' ? normalizeZipKey(geoId) : geoId;
    let geoName: string;
    if (config.geoType === 'national') geoName = 'United States';
    else if (config.geoType === 'zip') geoName = `ZIP ${finalGeoId}`;
    else geoName = (row as any)[config.nameField] || geoId;

    records.push({
      geography_id: finalGeoId, geography_type: config.geoType, geography_name: geoName,
      period_date: targetDate, affordable_home_price: affordablePrice, calculated_at: new Date().toISOString(),
    });
  }

  const { stored, errors: upsertErrors } = await batchUpsertRecords(supabase, records);
  return { processed: Object.keys(latestByGeo).length, stored, errors: [...errors, ...upsertErrors] };
}

// ---------------------------------------------------------------------------
// Public runners
// ---------------------------------------------------------------------------

type GeoResult = { total: { processed: number; stored: number }; byGeo: Record<string, { processed: number; stored: number }> };

export async function runIncomeToBuyMetrics(supabase: SupabaseClient): Promise<GeoResult> {
  const mortgageRate = await fetchMortgageRateFromFRED();
  const byGeo: Record<string, { processed: number; stored: number }> = {};
  let totalProcessed = 0, totalStored = 0;

  for (const config of REALTOR_GEO_CONFIGS) {
    const result = await calculateIncomeToBuyForGeo(supabase, config, mortgageRate);
    byGeo[config.geoType] = { processed: result.processed, stored: result.stored };
    totalProcessed += result.processed; totalStored += result.stored;
  }

  return { total: { processed: totalProcessed, stored: totalStored }, byGeo };
}

export async function runAffordableHomePriceMetrics(supabase: SupabaseClient): Promise<GeoResult> {
  const mortgageRate = await fetchMortgageRateFromFRED();
  const byGeo: Record<string, { processed: number; stored: number }> = {};
  let totalProcessed = 0, totalStored = 0;

  for (const config of CENSUS_INCOME_CONFIGS) {
    const result = await calculateAffordableHomePriceForGeo(supabase, config, mortgageRate);
    byGeo[config.geoType] = { processed: result.processed, stored: result.stored };
    totalProcessed += result.processed; totalStored += result.stored;
  }

  return { total: { processed: totalProcessed, stored: totalStored }, byGeo };
}
