/**
 * Populate Calculated Metrics
 *
 * This script calculates and stores all calculated metrics:
 * - Investment metrics (cap_rate, gross_yield, rent_to_price, grm)
 * - Overvalued percentage
 * - 5-year home value growth
 * - Inventory surplus
 *
 * Usage: npx tsx scripts/populate-calculated-metrics.ts
 *
 * To avoid API statement timeout on large upserts, set DATABASE_URL (Postgres URI)
 * or SUPABASE_DB_PASSWORD; then upserts use a direct pg connection with a 10-min timeout.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { normalizeZipKey } from './utils/zip';
import { Client } from 'pg';

// Try multiple env file locations
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Tried: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL');
  console.error('Tried: SUPABASE_SERVICE_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Optional direct Postgres client for upserts (avoids API statement timeout)
function getDbUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD;
  if (!password) return null;
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-1-us-east-1.pooler.supabase.com:6543/postgres`;
  } catch {
    return null;
  }
}

let pgClient: Client | null = null;
async function ensurePgClient(): Promise<Client | null> {
  if (pgClient) return pgClient;
  const url = getDbUrl();
  if (!url) return null;
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query("SET statement_timeout = '600000'"); // 10 min
    pgClient = client;
    return client;
  } catch (e) {
    console.warn('Direct Postgres connection failed, using Supabase API for upserts:', (e as Error).message);
    return null;
  }
}

// Constants
const EXPENSE_RATIO = 0.6;
const PRICE_TO_INCOME_BENCHMARK = 3.5;
const NATIONAL_MEDIAN_INCOME = 75000;
/** Small batches so each upsert finishes under Supabase API timeout (often ~8s). */
const BATCH_SIZE = 25;
/** Rows per request; keep small so SELECTs complete quickly. */
const ROWS_PER_PAGE = 250;
/** Pause between batches to avoid overwhelming the DB. */
const BATCH_DELAY_MS = 200;

// Data validation bounds - filter out unreasonable data
const MIN_VALID_PRICE = 10000;      // $10,000 minimum home price
const MAX_VALID_PRICE = 50000000;   // $50M maximum home price
const MIN_VALID_RENT = 100;         // $100/month minimum rent
const MAX_VALID_RENT = 15000;       // $15,000/month maximum rent
const MIN_VALID_CAP_RATE = 0.5;     // 0.5% minimum cap rate
const MAX_VALID_CAP_RATE = 20;      // 20% maximum cap rate

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function isValidRent(rent: number): boolean {
  return rent >= MIN_VALID_RENT && rent <= MAX_VALID_RENT;
}

function isValidPrice(price: number): boolean {
  return price >= MIN_VALID_PRICE && price <= MAX_VALID_PRICE;
}

function isValidCapRate(capRate: number): boolean {
  return capRate >= MIN_VALID_CAP_RATE && capRate <= MAX_VALID_CAP_RATE;
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

function calculateCapRate(rent: number, price: number): number | null {
  if (!rent || !price || price === 0) return null;
  if (!isValidRent(rent) || !isValidPrice(price)) return null;
  const capRate = (rent * 12 * EXPENSE_RATIO) / price * 100;
  // Return null if cap rate is outside valid bounds
  if (!isValidCapRate(capRate)) return null;
  return capRate;
}

function calculateGrossYield(rent: number, price: number): number | null {
  if (!rent || !price || price === 0) return null;
  if (!isValidRent(rent) || !isValidPrice(price)) return null;
  return (rent * 12) / price * 100;
}

function calculateRentToPriceRatio(rent: number, price: number): number | null {
  if (!rent || !price || price === 0) return null;
  if (!isValidRent(rent) || !isValidPrice(price)) return null;
  return rent / price;
}

function calculateGRM(price: number, rent: number): number | null {
  if (!price || !rent || rent === 0) return null;
  if (!isValidRent(rent) || !isValidPrice(price)) return null;
  return price / (rent * 12);
}

function calculateOvervalued(price: number, income: number): number | null {
  if (!price || !income || income === 0) return null;
  const priceToIncome = price / income;
  return ((priceToIncome - PRICE_TO_INCOME_BENCHMARK) / PRICE_TO_INCOME_BENCHMARK) * 100;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Dedupe by (geography_id, geography_type, period_date); keep last so upsert never sees same row twice. */
function dedupeByConflictKey(
  records: Array<{ geography_id: string; geography_type: string; period_date: string; [k: string]: unknown }>,
): typeof records {
  const byKey: Record<string, (typeof records)[number]> = {};
  for (const r of records) {
    if (!r.geography_id) continue;
    const key = `${r.geography_id}|${r.geography_type}|${r.period_date}`;
    byKey[key] = r;
  }
  return Object.values(byKey);
}

type InvestmentMetricRow = {
  geography_id: string;
  geography_type: string;
  geography_name: string | null;
  period_date: string;
  cap_rate: number | null;
  gross_yield: number | null;
  rent_to_price_ratio: number | null;
  grm: number | null;
  calculated_at: string;
};

/** Upsert batch to calculated_metrics; uses direct pg when available to avoid API timeout. */
async function upsertCalculatedMetricsBatch(
  batch: InvestmentMetricRow[],
): Promise<{ error: string | null }> {
  const client = await ensurePgClient();
  if (client && batch.length > 0) {
    try {
      const cols = 'geography_id, geography_type, geography_name, period_date, cap_rate, gross_yield, rent_to_price_ratio, grm, calculated_at';
      const placeholders: string[] = [];
      const values: (string | number | null)[] = [];
      let p = 0;
      for (const row of batch) {
        placeholders.push(`($${++p}, $${++p}, $${++p}, $${++p}::date, $${++p}, $${++p}, $${++p}, $${++p}, $${++p}::timestamptz)`);
        values.push(row.geography_id, row.geography_type, row.geography_name, row.period_date, row.cap_rate, row.gross_yield, row.rent_to_price_ratio, row.grm, row.calculated_at);
      }
      await client.query(
        `INSERT INTO calculated_metrics (${cols}) VALUES ${placeholders.join(', ')}
         ON CONFLICT (geography_id, geography_type, period_date)
         DO UPDATE SET geography_name = EXCLUDED.geography_name, cap_rate = EXCLUDED.cap_rate, gross_yield = EXCLUDED.gross_yield, rent_to_price_ratio = EXCLUDED.rent_to_price_ratio, grm = EXCLUDED.grm, calculated_at = EXCLUDED.calculated_at`,
        values,
      );
      return { error: null };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  const { error } = await supabase
    .from('calculated_metrics')
    .upsert(batch, { onConflict: 'geography_id,geography_type,period_date' });
  return { error: error?.message ?? null };
}

// ============================================================================
// INVESTMENT METRICS CALCULATION
// ============================================================================

interface InvestmentGeoConfig {
  zillowTable: string;
  realtorTable: string;
  censusTable: string;
  geoType: 'metro' | 'county' | 'zip';
  zillowIdField: string;
  realtorIdField: string;
  censusIdField: string;
  censusNameField: string | null;
}

const INVESTMENT_GEO_CONFIGS: InvestmentGeoConfig[] = [
  { zillowTable: 'zillow_metro', realtorTable: 'realtor_metro', censusTable: 'census_metro', geoType: 'metro', zillowIdField: 'cbsa_code', realtorIdField: 'cbsa_code', censusIdField: 'cbsa_code', censusNameField: 'cbsa_title' },
  { zillowTable: 'zillow_county', realtorTable: 'realtor_county', censusTable: 'census_county', geoType: 'county', zillowIdField: 'fips_code', realtorIdField: 'county_fips', censusIdField: 'fips_code', censusNameField: 'county_name' },
  { zillowTable: 'zillow_zip', realtorTable: 'realtor_zip', censusTable: 'census_zip', geoType: 'zip', zillowIdField: 'region_name', realtorIdField: 'postal_code', censusIdField: 'zcta', censusNameField: null },
];

/** Row shape from Zillow ZORI select (dynamic id field by geo). */
type ZorRow = { value?: number; region_name?: string; [k: string]: unknown };
/** Row shape from Realtor select (dynamic id field by geo). */
type RealtorPriceRow = { median_listing_price?: number; [k: string]: unknown };
/** Row shape from Census select (dynamic id/name fields by geo). */
type CensusRentRow = { median_gross_rent?: number; year?: number; [k: string]: unknown };

async function calculateInvestmentMetricsForGeo(config: InvestmentGeoConfig): Promise<{ processed: number; stored: number; errors: string[] }> {
  console.log(`\n📊 Calculating investment metrics for ${config.geoType} (full history)...`);
  const errors: string[] = [];
  let totalStored = 0;
  const client = await ensurePgClient();

  // Get all distinct period_dates from ZORI (use pg when available to avoid API timeout)
  console.log(`  Fetching distinct ZORI period_dates (paginated)...`);
  const periodDates: string[] = [];
  if (client) {
    try {
      const table = config.zillowTable; // zillow_metro, zillow_county, zillow_zip
      const { rows } = await client.query(
        `SELECT DISTINCT period_date FROM "${table}" WHERE metric_name = 'zori' AND value IS NOT NULL ORDER BY period_date`,
      );
      for (const row of rows) {
        if (row.period_date) periodDates.push(row.period_date);
      }
    } catch (e) {
      errors.push((e as Error).message);
    }
  } else {
    let offset = 0;
    const seenDates = new Set<string>();
    while (true) {
      const { data, error } = await supabase
        .from(config.zillowTable)
        .select('period_date')
        .eq('metric_name', 'zori')
        .not('value', 'is', null)
        .order('period_date', { ascending: true })
        .range(offset, offset + ROWS_PER_PAGE - 1);
      if (error) {
        errors.push(error.message);
        break;
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        if (row.period_date && !seenDates.has(row.period_date)) {
          seenDates.add(row.period_date);
          periodDates.push(row.period_date);
        }
      }
      if (data.length < ROWS_PER_PAGE) break;
      offset += ROWS_PER_PAGE;
    }
  }

  console.log(`  Found ${periodDates.length} period_dates with ZORI data`);

  for (let i = 0; i < periodDates.length; i++) {
    const periodDateRaw = periodDates[i];
    const periodDate = typeof periodDateRaw === 'string' ? periodDateRaw : new Date(periodDateRaw).toISOString().split('T')[0];
    if ((i + 1) % 12 === 0 || i === 0 || i === periodDates.length - 1) {
      console.log(`  Processing date ${i + 1}/${periodDates.length}: ${periodDate}`);
    }

    // ZORI for this date
    const rentByGeo: Record<string, { value: number; name: string }> = {};
    const zoriIdCol = config.zillowIdField;
    const zoriTable = config.zillowTable;
    if (client) {
      try {
        const { rows } = await client.query(
          `SELECT region_name, value, ${zoriIdCol} FROM "${zoriTable}" WHERE metric_name = 'zori' AND period_date = $1::date AND value IS NOT NULL`,
          [periodDate],
        );
        for (const row of rows) {
          let geoId = row[zoriIdCol] != null ? String(row[zoriIdCol]).trim() : '';
          if (config.geoType === 'zip' && geoId) geoId = normalizeZipKey(geoId);
          const val = row.value;
          if (!geoId || val == null || !isValidRent(val)) continue;
          rentByGeo[geoId] = { value: val, name: (row.region_name as string) ?? '' };
        }
      } catch (e) {
        errors.push((e as Error).message);
      }
    } else {
      let zoriOffset = 0;
      while (true) {
        const { data, error } = await supabase
          .from(zoriTable)
          .select(`region_id, region_name, value, ${zoriIdCol}`)
          .eq('metric_name', 'zori')
          .eq('period_date', periodDate)
          .not('value', 'is', null)
          .range(zoriOffset, zoriOffset + ROWS_PER_PAGE - 1);
        if (error) {
          errors.push(error.message);
          break;
        }
        if (!data || data.length === 0) break;
        for (const row of data as unknown as ZorRow[]) {
          let geoId = row[zoriIdCol] as string | undefined;
          if (config.geoType === 'zip' && geoId) geoId = normalizeZipKey(String(geoId));
          const val = row.value;
          if (!geoId || val == null || !isValidRent(val)) continue;
          rentByGeo[geoId] = { value: val, name: (row.region_name as string) ?? '' };
        }
        if (data.length < ROWS_PER_PAGE) break;
        zoriOffset += ROWS_PER_PAGE;
      }
    }

    // Realtor price for this date (Realtor uses first-of-month; ZORI may use end-of-month — align by month)
    const priceByCode: Record<string, number> = {};
    const realtorIdCol = config.realtorIdField;
    const realtorTable = config.realtorTable;
    const realtorDate = periodDate.slice(0, 7) + '-01'; // same month, first day
    if (client) {
      try {
        const { rows } = await client.query(
          `SELECT ${realtorIdCol}, median_listing_price FROM "${realtorTable}" WHERE period_date = $1::date AND median_listing_price IS NOT NULL`,
          [realtorDate],
        );
        for (const row of rows) {
          let id = row[realtorIdCol] != null ? String(row[realtorIdCol]).trim() : '';
          if (config.geoType === 'zip' && id) id = normalizeZipKey(id);
          const price = row.median_listing_price;
          if (id && price != null && isValidPrice(price)) priceByCode[id] = price;
        }
      } catch (e) {
        errors.push((e as Error).message);
      }
    } else {
      let priceOffset = 0;
      while (true) {
        const { data, error } = await supabase
          .from(realtorTable)
          .select(`${realtorIdCol}, median_listing_price`)
          .eq('period_date', realtorDate)
          .not('median_listing_price', 'is', null)
          .range(priceOffset, priceOffset + ROWS_PER_PAGE - 1);
        if (error) {
          errors.push(error.message);
          break;
        }
        if (!data || data.length === 0) break;
        for (const row of data as unknown as RealtorPriceRow[]) {
          let id = row[realtorIdCol] as string | undefined;
          if (config.geoType === 'zip' && id) id = normalizeZipKey(String(id));
          const price = row.median_listing_price;
          if (id && price != null && isValidPrice(price)) priceByCode[id] = price;
        }
        if (data.length < ROWS_PER_PAGE) break;
        priceOffset += ROWS_PER_PAGE;
      }
    }

    const recordsToUpsert: any[] = [];
    for (const [geoId, rentInfo] of Object.entries(rentByGeo)) {
      const price = priceByCode[geoId];
      if (!price) continue;

      const capRate = calculateCapRate(rentInfo.value, price);
      const grossYield = calculateGrossYield(rentInfo.value, price);
      const rentToPriceRatio = calculateRentToPriceRatio(rentInfo.value, price);
      const grm = calculateGRM(price, rentInfo.value);

      if (capRate === null && grossYield === null && rentToPriceRatio === null && grm === null) continue;

      const geoName = config.geoType === 'zip' ? (rentInfo.name || `ZIP ${geoId}`) : rentInfo.name;
      recordsToUpsert.push({
        geography_id: geoId,
        geography_type: config.geoType,
        geography_name: geoName,
        period_date: periodDate,
        cap_rate: capRate != null ? Math.round(capRate * 100) / 100 : null,
        gross_yield: grossYield != null ? Math.round(grossYield * 100) / 100 : null,
        rent_to_price_ratio: rentToPriceRatio != null ? Math.round(rentToPriceRatio * 10000) / 10000 : null,
        grm: grm != null ? Math.round(grm * 100) / 100 : null,
        calculated_at: new Date().toISOString(),
      });
    }

    // Dedupe by conflict key so one batch never has the same row twice
    const deduped = dedupeByConflictKey(recordsToUpsert);

    let batchOffset = 0;
    while (batchOffset < deduped.length) {
      const batch = deduped.slice(batchOffset, batchOffset + BATCH_SIZE) as InvestmentMetricRow[];
      const { error } = await upsertCalculatedMetricsBatch(batch);
      if (error) errors.push(error);
      else totalStored += batch.length;
      batchOffset += BATCH_SIZE;
      if (batchOffset < deduped.length) await delay(BATCH_DELAY_MS);
    }
  }

  // Fill-in: HUD FMR + Census + latest Realtor for geos with no ZORI (one row per geo at latest date)
  const rentByGeoFallback: Record<string, { value: number; name: string }> = {};
  if (config.geoType === 'county') {
    const { data: hudYearRow } = await supabase.from('hud_fmr').select('year').order('year', { ascending: false }).limit(1).single();
    if (hudYearRow?.year) {
      const { data: hudData } = await supabase.from('hud_fmr').select('fips_code, county_name, fmr_2br').eq('year', hudYearRow.year).not('fmr_2br', 'is', null);
      for (const row of hudData || []) {
        if (row.fips_code && isValidRent(row.fmr_2br)) {
          rentByGeoFallback[row.fips_code] = { value: row.fmr_2br, name: row.county_name || `County ${row.fips_code}` };
        }
      }
    }
  }

  const censusSelectFields = config.censusNameField
    ? `${config.censusIdField}, ${config.censusNameField}, median_gross_rent, year`
    : `${config.censusIdField}, median_gross_rent, year`;
  let censusOffset = 0;
  while (true) {
    const { data } = await supabase.from(config.censusTable).select(censusSelectFields).not('median_gross_rent', 'is', null).gt('median_gross_rent', 0).order('year', { ascending: false }).range(censusOffset, censusOffset + ROWS_PER_PAGE - 1);
    if (!data || data.length === 0) break;
    for (const row of data as unknown as CensusRentRow[]) {
      const geoId = row[config.censusIdField] as string | undefined;
      const rent = row.median_gross_rent;
      if (!geoId || rent == null || !isValidRent(rent)) continue;
      if (!rentByGeoFallback[geoId]) {
        const geoName = config.censusNameField ? row[config.censusNameField] : `${config.geoType} ${geoId}`;
        rentByGeoFallback[geoId] = { value: rent, name: (geoName as string) || geoId };
      }
    }
    if (data.length < ROWS_PER_PAGE) break;
    censusOffset += ROWS_PER_PAGE;
  }

  const { data: latestRealtorRow } = await supabase.from(config.realtorTable).select('period_date').order('period_date', { ascending: false }).limit(1).single();
  const latestDate = latestRealtorRow?.period_date;
  if (latestDate && Object.keys(rentByGeoFallback).length > 0) {
    const existingAtLatest = new Set<string>();
    let off = 0;
    while (true) {
      const { data: existing } = await supabase.from('calculated_metrics').select('geography_id').eq('geography_type', config.geoType).eq('period_date', latestDate).range(off, off + ROWS_PER_PAGE - 1);
      if (!existing || existing.length === 0) break;
      existing.forEach((r: { geography_id: string }) => existingAtLatest.add(r.geography_id));
      if (existing.length < ROWS_PER_PAGE) break;
      off += ROWS_PER_PAGE;
    }

    const priceByCode: Record<string, number> = {};
    let priceOffset = 0;
    while (true) {
      const { data } = await supabase.from(config.realtorTable).select(`${config.realtorIdField}, median_listing_price`).eq('period_date', latestDate).not('median_listing_price', 'is', null).range(priceOffset, priceOffset + ROWS_PER_PAGE - 1);
      if (!data || data.length === 0) break;
      for (const row of data as unknown as RealtorPriceRow[]) {
        let id = row[config.realtorIdField] as string | undefined;
        if (config.geoType === 'zip' && id) id = normalizeZipKey(String(id));
        const price = row.median_listing_price;
        if (id && price != null && isValidPrice(price)) priceByCode[id] = price;
      }
      if (data.length < ROWS_PER_PAGE) break;
      priceOffset += ROWS_PER_PAGE;
    }

    const recordsToUpsert: any[] = [];
    for (const [geoId, rentInfo] of Object.entries(rentByGeoFallback)) {
      if (existingAtLatest.has(geoId)) continue;
      const price = priceByCode[geoId];
      if (!price) continue;
      const capRate = calculateCapRate(rentInfo.value, price);
      const grossYield = calculateGrossYield(rentInfo.value, price);
      const rentToPriceRatio = calculateRentToPriceRatio(rentInfo.value, price);
      const grm = calculateGRM(price, rentInfo.value);
      if (capRate === null && grossYield === null && rentToPriceRatio === null && grm === null) continue;
      const geoName = config.geoType === 'zip' ? (rentInfo.name || `ZIP ${geoId}`) : rentInfo.name;
      recordsToUpsert.push({
        geography_id: geoId,
        geography_type: config.geoType,
        geography_name: geoName,
        period_date: latestDate,
        cap_rate: capRate != null ? Math.round(capRate * 100) / 100 : null,
        gross_yield: grossYield != null ? Math.round(grossYield * 100) / 100 : null,
        rent_to_price_ratio: rentToPriceRatio != null ? Math.round(rentToPriceRatio * 10000) / 10000 : null,
        grm: grm != null ? Math.round(grm * 100) / 100 : null,
        calculated_at: new Date().toISOString(),
      });
    }
    let batchOffset = 0;
    while (batchOffset < recordsToUpsert.length) {
      const batch = recordsToUpsert.slice(batchOffset, batchOffset + BATCH_SIZE) as InvestmentMetricRow[];
      const { error } = await upsertCalculatedMetricsBatch(batch);
      if (!error) totalStored += batch.length;
      batchOffset += BATCH_SIZE;
      if (batchOffset < recordsToUpsert.length) await delay(BATCH_DELAY_MS);
    }
    console.log(`  Fill-in: stored ${recordsToUpsert.length} ${config.geoType}s from HUD/Census at ${latestDate}`);
  }

  console.log(`  ✓ Stored ${totalStored} ${config.geoType} investment metrics records (full history + fill-in)`);
  return { processed: periodDates.length, stored: totalStored, errors };
}

async function calculateAllInvestmentMetrics(): Promise<{ processed: number; stored: number; errors: string[]; byGeo: Record<string, number> }> {
  let totalProcessed = 0;
  let totalStored = 0;
  const allErrors: string[] = [];
  const byGeo: Record<string, number> = {};

  for (const config of INVESTMENT_GEO_CONFIGS) {
    const result = await calculateInvestmentMetricsForGeo(config);
    totalProcessed += result.processed;
    totalStored += result.stored;
    allErrors.push(...result.errors);
    byGeo[config.geoType] = result.stored;
  }

  return { processed: totalProcessed, stored: totalStored, errors: allErrors, byGeo };
}

// ============================================================================
// OVERVALUED PERCENTAGE CALCULATION
// ============================================================================

async function calculateOvervaluedForMetros(): Promise<{ processed: number; stored: number; errors: string[] }> {
  console.log('\n📊 Calculating overvalued percentage for metros...');
  const errors: string[] = [];

  // Get latest ZHVI date from zillow_metro table (long format)
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
  console.log(`  Target date: ${targetDate}`);

  // Get ZHVI data for all metros from zillow_metro table
  const { data: zhviData, error: zhviError } = await supabase
    .from('zillow_metro')
    .select('region_id, region_name, value, cbsa_code')
    .eq('metric_name', 'zhvi')
    .eq('period_date', targetDate)
    .not('value', 'is', null);

  if (zhviError || !zhviData) {
    return { processed: 0, stored: 0, errors: [zhviError?.message || 'Failed to fetch ZHVI data'] };
  }

  console.log(`  Found ${zhviData.length} metros with ZHVI data`);

  // Get Census median income data
  const { data: incomeData } = await supabase
    .from('census_data')
    .select('geography_id, value')
    .eq('geography_type', 'metro')
    .eq('metric_name', 'median_income')
    .order('year', { ascending: false });

  // Build income lookup
  const incomeByGeo: Record<string, number> = {};
  if (incomeData) {
    for (const row of incomeData) {
      if (row.value && !incomeByGeo[row.geography_id]) {
        incomeByGeo[row.geography_id] = Number(row.value);
      }
    }
  }
  console.log(`  Found ${Object.keys(incomeByGeo).length} metros with income data`);

  // Calculate and batch upsert (filter null geography_id, dedupe by cbsa to avoid "row a second time")
  let stored = 0;
  const byKey: Record<string, { geography_id: string; geography_type: string; geography_name: string | null; period_date: string; overvalued_pct: number; calculated_at: string }> = {};

  for (const metro of zhviData) {
    const cbsaCode = metro.cbsa_code;
    if (!cbsaCode) continue;

    const zhvi = metro.value;
    const medianIncome = incomeByGeo[cbsaCode] || NATIONAL_MEDIAN_INCOME;
    const overvaluedPct = calculateOvervalued(zhvi, medianIncome);
    if (overvaluedPct === null) continue;

    const key = `${cbsaCode}|metro|${targetDate}`;
    byKey[key] = {
      geography_id: cbsaCode,
      geography_type: 'metro',
      geography_name: metro.region_name,
      period_date: targetDate,
      overvalued_pct: Math.round(overvaluedPct * 10) / 10,
      calculated_at: new Date().toISOString(),
    };
  }

  const recordsToUpsert = Object.values(byKey);
  for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
    const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('calculated_metrics')
      .upsert(batch, { onConflict: 'geography_id,geography_type,period_date' });
    if (error) {
      errors.push(error.message);
    } else {
      stored += batch.length;
    }
    if (i + BATCH_SIZE < recordsToUpsert.length) await delay(BATCH_DELAY_MS);
  }

  console.log(`  ✓ Stored ${stored} overvalued percentage records`);
  return { processed: zhviData.length, stored, errors };
}

// ============================================================================
// 5-YEAR GROWTH CALCULATION
// ============================================================================

async function calculate5YrGrowthForMetros(): Promise<{ processed: number; stored: number }> {
  console.log('\n📊 Calculating 5-year growth for metros...');

  // Get latest date
  const { data: latestDateRow } = await supabase
    .from('realtor_metro')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestDateRow?.period_date) {
    return { processed: 0, stored: 0 };
  }

  const targetDate = latestDateRow.period_date;
  const fiveYearsAgo = new Date(targetDate);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];
  const pastDateMax = new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`  Current date: ${targetDate}`);
  console.log(`  5-year ago window: ${pastDateStr} to ${pastDateMax}`);

  // Get current data
  const { data: currentData } = await supabase
    .from('realtor_metro')
    .select('cbsa_code, cbsa_title, median_listing_price')
    .eq('period_date', targetDate)
    .not('median_listing_price', 'is', null);

  if (!currentData || currentData.length === 0) {
    return { processed: 0, stored: 0 };
  }

  console.log(`  Found ${currentData.length} metros with current data`);

  // Get historical data
  const { data: pastData } = await supabase
    .from('realtor_metro')
    .select('cbsa_code, median_listing_price')
    .gte('period_date', pastDateStr)
    .lte('period_date', pastDateMax)
    .not('median_listing_price', 'is', null)
    .order('period_date', { ascending: true });

  // Build lookup for past values
  const pastByRegion: Record<string, number> = {};
  if (pastData) {
    for (const row of pastData) {
      if (!pastByRegion[row.cbsa_code]) {
        pastByRegion[row.cbsa_code] = row.median_listing_price;
      }
    }
  }
  console.log(`  Found ${Object.keys(pastByRegion).length} metros with historical data`);

  // Calculate and store
  let stored = 0;
  for (const metro of currentData) {
    const pastValue = pastByRegion[metro.cbsa_code];
    if (!pastValue || pastValue === 0) continue;

    const growthPct = ((metro.median_listing_price - pastValue) / pastValue) * 100;

    const { error } = await supabase
      .from('calculated_metrics')
      .upsert({
        geography_id: metro.cbsa_code,
        geography_type: 'metro',
        geography_name: metro.cbsa_title,
        period_date: targetDate,
        home_value_5yr_cagr: Math.round(growthPct * 100) / 100,
        calculated_at: new Date().toISOString(),
      }, {
        onConflict: 'geography_id,geography_type,period_date',
      });

    if (!error) stored++;
  }

  console.log(`  ✓ Stored ${stored} 5-year growth records`);
  return { processed: currentData.length, stored };
}

async function calculate5YrGrowthForStates(): Promise<{ processed: number; stored: number }> {
  console.log('\n📊 Calculating 5-year growth for states...');

  const { data: latestDateRow } = await supabase
    .from('realtor_state')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (!latestDateRow?.period_date) {
    return { processed: 0, stored: 0 };
  }

  const targetDate = latestDateRow.period_date;
  const fiveYearsAgo = new Date(targetDate);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];
  const pastDateMax = new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: currentData } = await supabase
    .from('realtor_state')
    .select('state_id, state_name, median_listing_price')
    .eq('period_date', targetDate)
    .not('median_listing_price', 'is', null);

  if (!currentData || currentData.length === 0) {
    return { processed: 0, stored: 0 };
  }

  console.log(`  Found ${currentData.length} states with current data`);

  const { data: pastData } = await supabase
    .from('realtor_state')
    .select('state_id, median_listing_price')
    .gte('period_date', pastDateStr)
    .lte('period_date', pastDateMax)
    .not('median_listing_price', 'is', null)
    .order('period_date', { ascending: true });

  const pastByRegion: Record<string, number> = {};
  if (pastData) {
    for (const row of pastData) {
      if (!pastByRegion[row.state_id]) {
        pastByRegion[row.state_id] = row.median_listing_price;
      }
    }
  }

  let stored = 0;
  for (const state of currentData) {
    const pastValue = pastByRegion[state.state_id];
    if (!pastValue || pastValue === 0) continue;

    const growthPct = ((state.median_listing_price - pastValue) / pastValue) * 100;

    const { error } = await supabase
      .from('calculated_metrics')
      .upsert({
        geography_id: state.state_id,
        geography_type: 'state',
        geography_name: state.state_name,
        period_date: targetDate,
        home_value_5yr_cagr: Math.round(growthPct * 100) / 100,
        calculated_at: new Date().toISOString(),
      }, {
        onConflict: 'geography_id,geography_type,period_date',
      });

    if (!error) stored++;
  }

  console.log(`  ✓ Stored ${stored} state 5-year growth records`);
  return { processed: currentData.length, stored };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         POPULATE CALCULATED METRICS');
  console.log('═══════════════════════════════════════════════════════════════');

  const dbUrl = getDbUrl();
  if (dbUrl) {
    const client = await ensurePgClient();
    if (client) console.log('Using direct Postgres for calculated_metrics upserts (10-min timeout)\n');
    else console.log('Direct Postgres connection failed; using Supabase API (may hit timeout)\n');
  } else {
    console.log('Tip: Set SUPABASE_DB_PASSWORD or DATABASE_URL in packages/backend/.env to use direct Postgres and avoid upsert timeouts.\n');
  }

  const results: Record<string, any> = {};

  // 1. Investment Metrics (cap_rate, gross_yield, rent_to_price, grm) - ALL GEOGRAPHIES
  results.investmentMetrics = await calculateAllInvestmentMetrics();

  // 2. Overvalued Percentage
  results.overvalued = await calculateOvervaluedForMetros();

  // 3. 5-Year Growth
  results.growth5YrMetros = await calculate5YrGrowthForMetros();
  results.growth5YrStates = await calculate5YrGrowthForStates();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                       SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  let totalProcessed = 0;
  let totalStored = 0;

  for (const [key, value] of Object.entries(results)) {
    console.log(`\n${key}:`);
    console.log(`  Processed: ${value.processed}`);
    console.log(`  Stored: ${value.stored}`);
    if (value.byGeo) {
      console.log(`  By geo: ${Object.entries(value.byGeo).map(([g, c]) => `${g}:${c}`).join(', ')}`);
    }
    if (value.errors && value.errors.length > 0) {
      console.log(`  Errors: ${value.errors.slice(0, 3).join(', ')}`);
    }
    totalProcessed += value.processed;
    totalStored += value.stored;
  }

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(`TOTAL: Processed ${totalProcessed}, Stored ${totalStored}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Verify data
  console.log('\n📋 Verifying stored data...');

  const { data: sampleData, error: sampleError } = await supabase
    .from('calculated_metrics')
    .select('*')
    .eq('geography_type', 'metro')
    .not('cap_rate', 'is', null)
    .limit(5);

  if (sampleData && sampleData.length > 0) {
    console.log('\nSample calculated metrics:');
    for (const row of sampleData) {
      console.log(`  ${row.geography_name}: cap_rate=${row.cap_rate}%, gross_yield=${row.gross_yield}%, grm=${row.grm}`);
    }
  }

  const { count } = await supabase
    .from('calculated_metrics')
    .select('*', { count: 'exact', head: true })
    .not('cap_rate', 'is', null);

  console.log(`\n✓ Total records with cap_rate: ${count}`);

  if (pgClient) {
    await pgClient.end();
    pgClient = null;
  }
}

main().catch(console.error);
