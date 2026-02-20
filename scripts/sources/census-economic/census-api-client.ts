/**
 * Census Bureau ACS 5-Year API client.
 *
 * Fetches American Community Survey data for all geography levels:
 * national, state, metro (CBSA), county, place (city), and ZIP (ZCTA).
 *
 * API docs: https://api.census.gov/data.html
 */

import axios from 'axios';
import { parseNumeric, parseInteger } from '../../lib';
import {
  ACS_VARIABLES,
  CensusGeoType,
  STATE_FIPS_TO_NAME,
  STATE_FIPS_TO_ABBREV,
  LARGE_STATE_FIPS,
  rateLimitWait,
  computeHomeownershipRate,
} from './census-economic-config';

const CENSUS_BASE_URL = 'https://api.census.gov/data';

function getCensusApiKey(): string {
  const key = process.env.CENSUS_API_KEY;
  if (!key) {
    throw new Error('FATAL: CENSUS_API_KEY environment variable is not set.');
  }
  return key;
}

// ---------------------------------------------------------------------------
// Raw API call
// ---------------------------------------------------------------------------

interface CensusApiResult {
  success: boolean;
  data?: Record<string, string>[];
  error?: string;
}

async function fetchCensusACS(
  year: number,
  geography: CensusGeoType,
  stateFilter?: string,
): Promise<CensusApiResult> {
  await rateLimitWait();

  const variableKeys = Object.keys(ACS_VARIABLES).join(',');
  let forClause = `${geography}:*`;
  let inClause = '';

  if ((geography === 'place' || geography === 'county') && stateFilter) {
    inClause = `state:${stateFilter}`;
  } else if (geography === 'place' || geography === 'county') {
    inClause = 'state:*';
  }

  const params: Record<string, string> = {
    get: `NAME,${variableKeys}`,
    for: forClause,
    key: getCensusApiKey(),
  };

  if (inClause) {
    params.in = inClause;
  }

  try {
    console.log(`  Fetching Census ACS ${year} ${geography}...`);
    const response = await axios.get(`${CENSUS_BASE_URL}/${year}/acs/acs5`, { params, timeout: 60000 });

    if (!Array.isArray(response.data) || response.data.length < 2) {
      return { success: false, error: 'Invalid API response format' };
    }

    const headers = response.data[0] as string[];
    const records = response.data.slice(1).map((row: string[]) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

    console.log(`  Fetched ${records.length} records`);
    return { success: true, data: records };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  Census API error: ${message}`);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Transform a raw Census API row into a database record
// ---------------------------------------------------------------------------

function mapCensusBaseFields(row: Record<string, string>): Record<string, unknown> {
  return {
    total_population: parseInteger(row.B01003_001E),
    median_age: parseNumeric(row.B01002_001E),
    median_household_income: parseInteger(row.B19013_001E),
    per_capita_income: parseInteger(row.B19301_001E),
    total_housing_units: parseInteger(row.B25001_001E),
    owner_occupied_units: parseInteger(row.B25003_002E),
    renter_occupied_units: parseInteger(row.B25003_003E),
    homeownership_rate: computeHomeownershipRate(row.B25003_002E, row.B25003_001E),
    median_home_value: parseInteger(row.B25077_001E),
    median_gross_rent: parseInteger(row.B25064_001E),
    rent_as_pct_of_income: parseNumeric(row.B25071_001E),
  };
}

// ---------------------------------------------------------------------------
// Public fetchers for each geography level
// ---------------------------------------------------------------------------

export async function fetchCensusNational(year: number): Promise<Record<string, unknown>[]> {
  const result = await fetchCensusACS(year, 'us');
  if (!result.success || !result.data) return [];
  return result.data.map(row => ({ year, ...mapCensusBaseFields(row) }));
}

export async function fetchCensusStates(year: number): Promise<Record<string, unknown>[]> {
  const result = await fetchCensusACS(year, 'state');
  if (!result.success || !result.data) return [];
  return result.data.map(row => ({
    year,
    state_fips: row.state,
    state_name: STATE_FIPS_TO_NAME[row.state] || row.NAME,
    state_abbrev: STATE_FIPS_TO_ABBREV[row.state] || '',
    ...mapCensusBaseFields(row),
  }));
}

export async function fetchCensusMetros(year: number): Promise<Record<string, unknown>[]> {
  const result = await fetchCensusACS(year, 'metropolitan statistical area/micropolitan statistical area');
  if (!result.success || !result.data) return [];
  return result.data.map(row => ({
    year,
    cbsa_code: row['metropolitan statistical area/micropolitan statistical area'],
    cbsa_title: row.NAME,
    ...mapCensusBaseFields(row),
  }));
}

export async function fetchCensusCounties(year: number): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  const states = Object.keys(STATE_FIPS_TO_ABBREV).filter(f => f !== '72');

  for (const stateFips of states) {
    const result = await fetchCensusACS(year, 'county', stateFips);
    if (!result.success || !result.data) continue;
    for (const row of result.data) {
      records.push({
        year,
        fips_code: row.state + row.county,
        county_name: row.NAME?.replace(/, .*/, '') || '',
        state_fips: row.state,
        state_name: STATE_FIPS_TO_NAME[row.state] || '',
        ...mapCensusBaseFields(row),
      });
    }
  }
  return records;
}

export async function fetchCensusCities(year: number): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];

  for (const stateFips of LARGE_STATE_FIPS) {
    const result = await fetchCensusACS(year, 'place', stateFips);
    if (!result.success || !result.data) continue;
    for (const row of result.data) {
      records.push({
        year,
        place_fips: row.state + row.place,
        place_name: row.NAME?.replace(/, .*/, '') || '',
        state_fips: row.state,
        state_name: STATE_FIPS_TO_NAME[row.state] || '',
        ...mapCensusBaseFields(row),
      });
    }
  }
  return records;
}

export async function fetchCensusZips(year: number): Promise<Record<string, unknown>[]> {
  const result = await fetchCensusACS(year, 'zip code tabulation area');
  if (!result.success || !result.data) return [];
  return result.data.map(row => ({
    year,
    zcta: row['zip code tabulation area'],
    ...mapCensusBaseFields(row),
  }));
}
