/**
 * Bureau of Labor Statistics (BLS) QCEW API client.
 *
 * Fetches monthly unemployment data at county and metro levels using
 * BLS bulk timeseries API. Processes in batches of 50 series (BLS limit).
 *
 * API docs: https://www.bls.gov/developers/api_signature_v2.htm
 */

import axios from 'axios';
import { parseNumeric } from '../../lib';
import { STATE_ABBREV_TO_FIPS, rateLimitWait } from './census-economic-config';

const BLS_BASE_URL = 'https://api.bls.gov/publicAPI/v2';
const BLS_BATCH_SIZE = 50;
const BLS_MAX_YEAR_SPAN = 20;

function getBlsApiKey(): string | null {
  const key = process.env.BLS_API_KEY;
  if (!key) {
    console.warn('  WARNING: BLS_API_KEY not set — using unauthenticated API (lower rate limits)');
    return null;
  }
  return key;
}

// ---------------------------------------------------------------------------
// BLS batch fetch helper
// ---------------------------------------------------------------------------

interface BlsBatchResult {
  records: Record<string, unknown>[];
  successCount: number;
}

async function fetchBlsBatch(
  seriesIds: string[],
  startYear: number,
  endYear: number,
  extractRegionId: (seriesId: string) => string,
  buildRecord: (regionId: string, date: string, value: string) => Record<string, unknown>,
): Promise<BlsBatchResult> {
  const records: Record<string, unknown>[] = [];
  const seenRegions = new Set<string>();

  const yearRanges = buildYearRanges(startYear, endYear);
  const batches = chunkArray(seriesIds, BLS_BATCH_SIZE);
  const totalBatches = batches.length * yearRanges.length;
  let batchNum = 0;

  for (const yearRange of yearRanges) {
    for (const batch of batches) {
      batchNum++;
      if (batchNum % 20 === 1 || batchNum === totalBatches) {
        console.log(`    Processing batch ${batchNum}/${totalBatches}...`);
      }

      const requestBody: Record<string, unknown> = {
        seriesid: batch,
        startyear: String(yearRange.start),
        endyear: String(yearRange.end),
      };

      const blsKey = getBlsApiKey();
      if (blsKey) {
        requestBody.registrationkey = blsKey;
      }

      try {
        await rateLimitWait();
        const response = await axios.post(`${BLS_BASE_URL}/timeseries/data/`, requestBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
        });

        if (response.data?.status === 'REQUEST_SUCCEEDED' && response.data?.Results?.series) {
          for (const series of response.data.Results.series) {
            const regionId = extractRegionId(series.seriesID);
            if (series.data && series.data.length > 0) {
              seenRegions.add(regionId);
              for (const obs of series.data) {
                const month = obs.period.replace('M', '').padStart(2, '0');
                const date = `${obs.year}-${month}-01`;
                if (obs.value && obs.value !== '-') {
                  records.push(buildRecord(regionId, date, obs.value));
                }
              }
            }
          }
        } else if (response.data?.status !== 'REQUEST_SUCCEEDED') {
          console.log(`    Batch ${batchNum} status: ${response.data?.status}`);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`    Batch ${batchNum} error: ${message}`);
      }
    }
  }

  return { records, successCount: seenRegions.size };
}

// ---------------------------------------------------------------------------
// County unemployment
// ---------------------------------------------------------------------------

/**
 * Fetch monthly county unemployment from BLS.
 * Series format: LAUCN{5-digit-fips}0000000003 (unemployment rate).
 */
export async function fetchBlsCountyUnemployment(
  countyFipsList: string[],
  startYear: number = 2015,
  endYear?: number,
): Promise<Record<string, unknown>[]> {
  const resolvedEndYear = endYear ?? new Date().getFullYear();
  console.log(`  Fetching BLS monthly county unemployment rates...`);
  console.log(`  Processing ${countyFipsList.length} counties for years ${startYear}-${resolvedEndYear}...`);

  const seriesIds = countyFipsList.map(fips => `LAUCN${fips}0000000003`);

  const { records, successCount } = await fetchBlsBatch(
    seriesIds,
    startYear,
    resolvedEndYear,
    (seriesId) => seriesId.substring(5, 10),
    (fipsCode, date, value) => ({
      period_date: date,
      fips_code: fipsCode,
      state_fips: fipsCode.substring(0, 2),
      unemployment_rate: parseNumeric(value),
    }),
  );

  console.log(`  Fetched ${records.length} monthly county unemployment records from ${successCount} counties`);
  return records;
}

// ---------------------------------------------------------------------------
// Metro unemployment
// ---------------------------------------------------------------------------

interface MetroWithState {
  cbsa: string;
  state: string;
  title: string;
}

/**
 * Extract the principal state FIPS from a CBSA title.
 * Handles formats like "City-City, ST-ST (Metropolitan Statistical Area)".
 */
function getStateFipsFromCbsaTitle(cbsaTitle: string): string | null {
  let match = cbsaTitle.match(/,\s*([A-Z]{2})(?:-[A-Z]{2})*\s*\(/);
  if (match) return STATE_ABBREV_TO_FIPS[match[1]] || null;

  match = cbsaTitle.match(/,\s*([A-Z]{2})(?:-[A-Z]{2})*\s*$/);
  if (match) return STATE_ABBREV_TO_FIPS[match[1]] || null;

  return null;
}

/**
 * Fetch monthly metro unemployment from BLS.
 * Series format: LAUMT{state_fips}{cbsa_code}00000003 (unemployment rate).
 */
export async function fetchBlsMetroUnemployment(
  metros: Array<{ cbsa_code: string; cbsa_title: string }>,
  startYear: number = 2015,
  endYear?: number,
): Promise<Record<string, unknown>[]> {
  const resolvedEndYear = endYear ?? new Date().getFullYear();
  console.log(`  Fetching BLS monthly metro unemployment rates...`);
  console.log(`  Processing ${metros.length} metros for years ${startYear}-${resolvedEndYear}...`);

  const metrosWithState: MetroWithState[] = [];
  for (const metro of metros) {
    const stateFips = getStateFipsFromCbsaTitle(metro.cbsa_title);
    if (stateFips) {
      metrosWithState.push({ cbsa: metro.cbsa_code, state: stateFips, title: metro.cbsa_title });
    }
  }
  console.log(`  Found ${metrosWithState.length} metros with valid state FIPS`);

  const seriesIds = metrosWithState.map(m => `LAUMT${m.state}${m.cbsa}00000003`);

  const { records, successCount } = await fetchBlsBatch(
    seriesIds,
    startYear,
    resolvedEndYear,
    (seriesId) => seriesId.substring(7, 12),
    (cbsaCode, date, value) => ({
      period_date: date,
      cbsa_code: cbsaCode,
      unemployment_rate: parseNumeric(value),
    }),
  );

  console.log(`  Fetched ${records.length} monthly metro unemployment records from ${successCount} metros`);
  return records;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function buildYearRanges(startYear: number, endYear: number): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (let y = startYear; y <= endYear; y += BLS_MAX_YEAR_SPAN) {
    ranges.push({ start: y, end: Math.min(y + BLS_MAX_YEAR_SPAN - 1, endYear) });
  }
  return ranges;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
