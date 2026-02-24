/**
 * Bureau of Economic Analysis (BEA) API client.
 *
 * Fetches GDP, Real GDP, and Regional Price Parity data for
 * state, metro (MSA), and county geographies.
 *
 * API docs: https://apps.bea.gov/api/
 */

import axios from 'axios';
import { parseNumeric } from '../../lib';
import {
  STATE_FIPS_TO_NAME,
  STATE_FIPS_TO_ABBREV,
  rateLimitWait,
} from './census-economic-config';

const BEA_BASE_URL = 'https://apps.bea.gov/api/data';

function getBeaApiKey(): string {
  const key = process.env.BEA_API_KEY;
  if (!key) {
    throw new Error('FATAL: BEA_API_KEY environment variable is not set.');
  }
  return key;
}

type BeaGeoFips = 'STATE' | 'MSA' | 'COUNTY';

// ---------------------------------------------------------------------------
// Generic BEA fetch
// ---------------------------------------------------------------------------

interface BeaApiResult {
  success: boolean;
  data?: Record<string, string>[];
  error?: string;
}

async function fetchBeaRegional(
  tableName: string,
  lineCode: string,
  geoFips: BeaGeoFips,
  years: string = 'ALL',
): Promise<BeaApiResult> {
  await rateLimitWait();

  const params = {
    UserID: getBeaApiKey(),
    method: 'GetData',
    datasetname: 'Regional',
    TableName: tableName,
    LineCode: lineCode,
    GeoFips: geoFips,
    Year: years,
    ResultFormat: 'JSON',
  };

  try {
    console.log(`  Fetching BEA ${tableName} ${geoFips}...`);
    const response = await axios.get(BEA_BASE_URL, { params, timeout: 60000 });

    const result = response.data?.BEAAPI?.Results;
    if (!result || result.Error) {
      return { success: false, error: result?.Error?.APIErrorDescription || 'Unknown BEA error' };
    }

    const data = result.Data || [];
    console.log(`  Fetched ${data.length} records`);
    return { success: true, data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  BEA API error: ${message}`);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// State economic records
// ---------------------------------------------------------------------------

export async function fetchBeaStateGdp(): Promise<Record<string, unknown>[]> {
  const result = await fetchBeaRegional('CAGDP1', '1', 'STATE');
  if (!result.success || !result.data) return [];

  return result.data
    .filter(row => row.GeoFips && row.GeoFips !== '00000')
    .map(row => ({
      period_date: `${row.TimePeriod}-01-01`,
      state_fips: row.GeoFips?.substring(0, 2) || '',
      state_name: STATE_FIPS_TO_NAME[row.GeoFips?.substring(0, 2) || ''] || row.GeoName || '',
      state_abbrev: STATE_FIPS_TO_ABBREV[row.GeoFips?.substring(0, 2) || ''] || '',
      gdp_millions: parseNumeric(row.DataValue),
    }));
}

export async function fetchBeaStateRealGdp(): Promise<Record<string, unknown>[]> {
  const result = await fetchBeaRegional('CAGDP9', '1', 'STATE');
  if (!result.success || !result.data) return [];

  return result.data
    .filter(row => row.GeoFips && row.GeoFips !== '00000')
    .map(row => ({
      period_date: `${row.TimePeriod}-01-01`,
      state_fips: row.GeoFips?.substring(0, 2) || '',
      real_gdp_millions: parseNumeric(row.DataValue),
    }));
}

/**
 * Fetch state Regional Price Parities.
 * State uses SARPP table with LineCode 5 ("RPPs: All items").
 */
export async function fetchBeaStateRpp(): Promise<Record<string, unknown>[]> {
  const result = await fetchBeaRegional('SARPP', '5', 'STATE');
  if (!result.success || !result.data) return [];

  return result.data
    .filter(row => row.GeoFips && row.GeoFips !== '00000')
    .map(row => ({
      period_date: `${row.TimePeriod}-01-01`,
      state_fips: row.GeoFips?.substring(0, 2) || '',
      rpp_all_items: parseNumeric(row.DataValue),
    }));
}

// ---------------------------------------------------------------------------
// Metro economic records
// ---------------------------------------------------------------------------

export async function fetchBeaMetroGdp(): Promise<Record<string, unknown>[]> {
  const result = await fetchBeaRegional('CAGDP1', '1', 'MSA');
  if (!result.success || !result.data) return [];

  return result.data
    .filter(row => row.GeoFips && row.GeoFips.length >= 5)
    .map(row => ({
      period_date: `${row.TimePeriod}-01-01`,
      cbsa_code: row.GeoFips?.substring(0, 5) || '',
      cbsa_title: row.GeoName || '',
      gdp_millions: parseNumeric(row.DataValue),
    }));
}

/**
 * Fetch metro Regional Price Parities.
 * Metro uses MARPP table with LineCode 3 ("RPPs: All items").
 */
export async function fetchBeaMetroRpp(): Promise<Record<string, unknown>[]> {
  const result = await fetchBeaRegional('MARPP', '3', 'MSA');
  if (!result.success || !result.data) return [];

  return result.data
    .filter(row => row.GeoFips && row.GeoFips.length >= 5)
    .map(row => ({
      period_date: `${row.TimePeriod}-01-01`,
      cbsa_code: row.GeoFips?.substring(0, 5) || '',
      cbsa_title: row.GeoName || '',
      rpp_all_items: parseNumeric(row.DataValue),
    }));
}

// ---------------------------------------------------------------------------
// County economic records
// ---------------------------------------------------------------------------

export async function fetchBeaCountyGdp(): Promise<Record<string, unknown>[]> {
  const result = await fetchBeaRegional('CAGDP1', '1', 'COUNTY');
  if (!result.success || !result.data) return [];

  return result.data
    .filter(row => row.GeoFips && row.GeoFips.length === 5)
    .map(row => ({
      period_date: `${row.TimePeriod}-01-01`,
      fips_code: row.GeoFips || '',
      county_name: row.GeoName || '',
      state_fips: row.GeoFips?.substring(0, 2) || '',
      state_name: STATE_FIPS_TO_NAME[row.GeoFips?.substring(0, 2) || ''] || '',
      gdp_millions: parseNumeric(row.DataValue),
    }));
}

/**
 * @deprecated Derive county FIPS from fetchBeaCountyGdp() results instead
 * to avoid a redundant API call. Example:
 *   const countyGdp = await fetchBeaCountyGdp();
 *   const fipsList = [...new Set(countyGdp.map(r => String(r.fips_code)).filter(Boolean))];
 */
export async function fetchBeaCountyFipsList(): Promise<string[]> {
  const result = await fetchBeaRegional('CAGDP1', '1', 'COUNTY');
  if (!result.success || !result.data) return [];

  const fipsSet = new Set<string>();
  for (const row of result.data) {
    if (row.GeoFips && row.GeoFips.length === 5) {
      fipsSet.add(row.GeoFips);
    }
  }
  return Array.from(fipsSet);
}
