/**
 * API Clients for Census, BEA, and FRED data
 */

import axios from 'axios';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../../.env.local') });
config({ path: join(__dirname, '../../packages/frontend/.env.local') });
config({ path: join(__dirname, '../../packages/backend/.env') });

// API Keys
const CENSUS_API_KEY = process.env.CENSUS_API_KEY || 'ecfbba7f63c684383739d30133554b6e20485fe9';
const BEA_API_KEY = process.env.BEA_API_KEY || '693D94BD-4749-425B-995C-2BC37E35C886';
const FRED_API_KEY = process.env.FRED_API_KEY || '28446a6f75de86ba74668b13912d268c';

// API Base URLs
const CENSUS_BASE = 'https://api.census.gov/data';
const BEA_BASE = 'https://apps.bea.gov/api/data';
const FRED_BASE = 'https://api.stlouisfed.org/fred';
const BLS_BASE = 'https://api.bls.gov/publicAPI/v2';

// Rate limiting
let lastRequestTime = 0;
const RATE_LIMIT_MS = 500;

async function rateLimitWait(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// ============================================================================
// CENSUS API CLIENT
// ============================================================================

/**
 * Census ACS 5-Year variable codes
 */
export const ACS_VARIABLES = {
  // Demographics
  B01003_001E: 'total_population',
  B01002_001E: 'median_age',

  // Economics
  B19013_001E: 'median_household_income',
  B19301_001E: 'per_capita_income',

  // Housing
  B25001_001E: 'total_housing_units',
  B25003_001E: 'total_occupied_units',
  B25003_002E: 'owner_occupied_units',
  B25003_003E: 'renter_occupied_units',
  B25077_001E: 'median_home_value',
  B25064_001E: 'median_gross_rent',
  B25071_001E: 'rent_as_pct_of_income'
};

export interface CensusAPIResponse {
  success: boolean;
  data?: any[];
  error?: string;
}

/**
 * Fetch Census ACS 5-Year data
 */
export async function fetchCensusACS(
  year: number,
  geography: 'us' | 'state' | 'metropolitan statistical area/micropolitan statistical area' | 'county' | 'place' | 'zip code tabulation area',
  stateFilter?: string
): Promise<CensusAPIResponse> {
  await rateLimitWait();

  const variables = Object.keys(ACS_VARIABLES).join(',');
  let forClause = `${geography}:*`;
  let inClause = '';

  // For place and county, need state filter
  if ((geography === 'place' || geography === 'county') && stateFilter) {
    inClause = `state:${stateFilter}`;
  } else if (geography === 'place' || geography === 'county') {
    inClause = 'state:*';
  }

  const url = `${CENSUS_BASE}/${year}/acs/acs5`;
  const params: Record<string, string> = {
    get: `NAME,${variables}`,
    for: forClause,
    key: CENSUS_API_KEY
  };

  if (inClause) {
    params.in = inClause;
  }

  try {
    console.log(`  Fetching Census ACS ${year} ${geography}...`);
    const response = await axios.get(url, { params, timeout: 60000 });

    if (!Array.isArray(response.data) || response.data.length < 2) {
      return { success: false, error: 'Invalid API response format' };
    }

    // Convert array format to objects
    const headers = response.data[0] as string[];
    const records = response.data.slice(1).map((row: any[]) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });

    console.log(`  Fetched ${records.length} records`);
    return { success: true, data: records };
  } catch (error: any) {
    console.error(`  Census API error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch Census County Business Patterns data
 */
export async function fetchCensusCBP(
  year: number,
  geography: 'us' | 'state' | 'county' | 'zipcode'
): Promise<CensusAPIResponse> {
  await rateLimitWait();

  // CBP variables
  const variables = 'EMP,ESTAB,PAYANN'; // Employment, Establishments, Annual Payroll

  let forClause = '';
  let inClause = '';

  switch (geography) {
    case 'us':
      forClause = 'us:*';
      break;
    case 'state':
      forClause = 'state:*';
      break;
    case 'county':
      forClause = 'county:*';
      inClause = 'state:*';
      break;
    case 'zipcode':
      forClause = 'zipcode:*';
      break;
  }

  const url = `${CENSUS_BASE}/${year}/cbp`;
  const params: Record<string, string> = {
    get: `NAME,${variables}`,
    for: forClause,
    key: CENSUS_API_KEY
  };

  if (inClause) {
    params.in = inClause;
  }

  try {
    console.log(`  Fetching Census CBP ${year} ${geography}...`);
    const response = await axios.get(url, { params, timeout: 60000 });

    if (!Array.isArray(response.data) || response.data.length < 2) {
      return { success: false, error: 'Invalid API response format' };
    }

    const headers = response.data[0] as string[];
    const records = response.data.slice(1).map((row: any[]) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });

    console.log(`  Fetched ${records.length} records`);
    return { success: true, data: records };
  } catch (error: any) {
    console.error(`  Census CBP API error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// BEA API CLIENT
// ============================================================================

export interface BEAAPIResponse {
  success: boolean;
  data?: any[];
  error?: string;
}

/**
 * Fetch BEA Regional GDP data
 */
export async function fetchBEAGDP(
  geography: 'STATE' | 'MSA' | 'COUNTY',
  years: string = 'LAST5'
): Promise<BEAAPIResponse> {
  await rateLimitWait();

  const params = {
    UserID: BEA_API_KEY,
    method: 'GetData',
    datasetname: 'Regional',
    TableName: 'CAGDP1', // GDP in current dollars
    LineCode: '1', // All industry total
    GeoFips: geography,
    Year: years,
    ResultFormat: 'JSON'
  };

  try {
    console.log(`  Fetching BEA GDP ${geography}...`);
    const response = await axios.get(BEA_BASE, { params, timeout: 60000 });

    const result = response.data?.BEAAPI?.Results;
    if (!result || result.Error) {
      return { success: false, error: result?.Error?.APIErrorDescription || 'Unknown BEA error' };
    }

    const data = result.Data || [];
    console.log(`  Fetched ${data.length} records`);
    return { success: true, data };
  } catch (error: any) {
    console.error(`  BEA API error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch BEA Real GDP data
 */
export async function fetchBEARealGDP(
  geography: 'STATE' | 'MSA' | 'COUNTY',
  years: string = 'LAST5'
): Promise<BEAAPIResponse> {
  await rateLimitWait();

  const params = {
    UserID: BEA_API_KEY,
    method: 'GetData',
    datasetname: 'Regional',
    TableName: 'CAGDP9', // Real GDP (chained dollars)
    LineCode: '1',
    GeoFips: geography,
    Year: years,
    ResultFormat: 'JSON'
  };

  try {
    console.log(`  Fetching BEA Real GDP ${geography}...`);
    const response = await axios.get(BEA_BASE, { params, timeout: 60000 });

    const result = response.data?.BEAAPI?.Results;
    if (!result || result.Error) {
      return { success: false, error: result?.Error?.APIErrorDescription || 'Unknown BEA error' };
    }

    const data = result.Data || [];
    console.log(`  Fetched ${data.length} records`);
    return { success: true, data };
  } catch (error: any) {
    console.error(`  BEA API error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch BEA Regional Price Parities (Cost of Living)
 *
 * Note: Different tables and LineCodes for different geographies:
 * - State: SARPP table, LineCode 5 = "RPPs: All items"
 * - Metro: MARPP table, LineCode 3 = "RPPs: All items"
 */
export async function fetchBEARPP(
  geography: 'STATE' | 'MSA',
  years: string = 'LAST5'
): Promise<BEAAPIResponse> {
  await rateLimitWait();

  // Different tables and LineCodes for state vs metro
  const tableName = geography === 'STATE' ? 'SARPP' : 'MARPP';
  const lineCode = geography === 'STATE' ? '5' : '3';  // RPPs: All items

  const params = {
    UserID: BEA_API_KEY,
    method: 'GetData',
    datasetname: 'Regional',
    TableName: tableName,
    LineCode: lineCode,
    GeoFips: geography,
    Year: years,
    ResultFormat: 'JSON'
  };

  try {
    console.log(`  Fetching BEA RPP ${geography}...`);
    const response = await axios.get(BEA_BASE, { params, timeout: 60000 });

    const result = response.data?.BEAAPI?.Results;
    if (!result || result.Error) {
      return { success: false, error: result?.Error?.APIErrorDescription || 'Unknown BEA error' };
    }

    const data = result.Data || [];
    console.log(`  Fetched ${data.length} records`);
    return { success: true, data };
  } catch (error: any) {
    console.error(`  BEA API error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// FRED API CLIENT
// ============================================================================

export interface FREDAPIResponse {
  success: boolean;
  data?: any[];
  error?: string;
}

/**
 * Fetch FRED series data
 */
export async function fetchFREDSeries(
  seriesId: string,
  observationStart?: string,
  observationEnd?: string
): Promise<FREDAPIResponse> {
  await rateLimitWait();

  const params: Record<string, string> = {
    series_id: seriesId,
    api_key: FRED_API_KEY,
    file_type: 'json'
  };

  if (observationStart) params.observation_start = observationStart;
  if (observationEnd) params.observation_end = observationEnd;

  try {
    const response = await axios.get(`${FRED_BASE}/series/observations`, { params, timeout: 30000 });
    const observations = response.data?.observations || [];
    return { success: true, data: observations };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch national unemployment rate from FRED
 */
export async function fetchFREDUnemploymentNational(
  startYear: number = 2015
): Promise<FREDAPIResponse> {
  console.log(`  Fetching FRED national unemployment rate...`);
  return fetchFREDSeries('UNRATE', `${startYear}-01-01`);
}

/**
 * State FIPS to FRED state unemployment series ID mapping
 */
const STATE_FIPS_TO_FRED_UR: Record<string, string> = {
  '01': 'ALUR', '02': 'AKUR', '04': 'AZUR', '05': 'ARUR', '06': 'CAUR',
  '08': 'COUR', '09': 'CTUR', '10': 'DEUR', '11': 'DCUR', '12': 'FLUR',
  '13': 'GAUR', '15': 'HIUR', '16': 'IDUR', '17': 'ILUR', '18': 'INUR',
  '19': 'IAUR', '20': 'KSUR', '21': 'KYUR', '22': 'LAUR', '23': 'MEUR',
  '24': 'MDUR', '25': 'MAUR', '26': 'MIUR', '27': 'MNUR', '28': 'MSUR',
  '29': 'MOUR', '30': 'MTUR', '31': 'NEUR', '32': 'NVUR', '33': 'NHUR',
  '34': 'NJUR', '35': 'NMUR', '36': 'NYUR', '37': 'NCUR', '38': 'NDUR',
  '39': 'OHUR', '40': 'OKUR', '41': 'ORUR', '42': 'PAUR', '44': 'RIUR',
  '45': 'SCUR', '46': 'SDUR', '47': 'TNUR', '48': 'TXUR', '49': 'UTUR',
  '50': 'VTUR', '51': 'VAUR', '53': 'WAUR', '54': 'WVUR', '55': 'WIUR',
  '56': 'WYUR'
};

/**
 * Fetch state unemployment rates from FRED
 */
export async function fetchFREDUnemploymentStates(
  startYear: number = 2015
): Promise<FREDAPIResponse> {
  console.log(`  Fetching FRED state unemployment rates...`);

  const allData: any[] = [];
  const startDate = `${startYear}-01-01`;

  for (const [fips, seriesId] of Object.entries(STATE_FIPS_TO_FRED_UR)) {
    const result = await fetchFREDSeries(seriesId, startDate);
    if (result.success && result.data) {
      for (const obs of result.data) {
        allData.push({
          state_fips: fips,
          date: obs.date,
          value: obs.value
        });
      }
    }
  }

  console.log(`  Fetched ${allData.length} state unemployment records`);
  return { success: true, data: allData };
}

/**
 * Fetch metro unemployment rate from FRED
 * Uses CBSA-specific series like LAUMT{CBSA}0000000003
 */
export async function fetchFREDUnemploymentMetro(
  cbsaCode: string,
  startYear: number = 2015
): Promise<FREDAPIResponse> {
  // FRED uses different series format for metros
  const seriesId = `LAUMT${cbsaCode}0000000003`;
  return fetchFREDSeries(seriesId, `${startYear}-01-01`);
}

/**
 * Fetch county unemployment rate from FRED
 * Uses LAUCN{FIPS}0000000003 format
 */
export async function fetchFREDUnemploymentCounty(
  countyFips: string,
  startYear: number = 2015
): Promise<FREDAPIResponse> {
  const seriesId = `LAUCN${countyFips}0000000003`;
  return fetchFREDSeries(seriesId, `${startYear}-01-01`);
}

// ============================================================================
// FRED EMPLOYMENT DATA (for Job Growth)
// ============================================================================

/**
 * Fetch national total nonfarm employment from FRED
 * Series: PAYEMS - All Employees: Total Nonfarm (Thousands)
 */
export async function fetchFREDEmploymentNational(
  startYear: number = 2000
): Promise<FREDAPIResponse> {
  console.log(`  Fetching FRED national employment (PAYEMS)...`);
  return fetchFREDSeries('PAYEMS', `${startYear}-01-01`);
}

/**
 * State FIPS to FRED state employment series ID mapping
 * Format: {ST}NA - Total Nonfarm, All Employees, Not Seasonally Adjusted
 * Some states use SMU format instead
 */
const STATE_FIPS_TO_FRED_EMP: Record<string, string> = {
  '01': 'ALNA', '02': 'AKNA', '04': 'AZNA', '05': 'ARNA', '06': 'CANA',
  '08': 'CONA', '09': 'CTNA', '10': 'DENA', '11': 'DCNA', '12': 'FLNA',
  '13': 'GANA', '15': 'HINA', '16': 'IDNA', '17': 'ILNA', '18': 'INNA',
  '19': 'IANA', '20': 'KSNA', '21': 'KYNA', '22': 'LANA', '23': 'MENA',
  '24': 'MDNA', '25': 'MANA', '26': 'MINA', '27': 'MNNA', '28': 'MSNA',
  '29': 'MONA', '30': 'MTNA', '31': 'NENA', '32': 'NVNA', '33': 'NHNA',
  '34': 'NJNA', '35': 'NMNA', '36': 'NYNA', '37': 'NCNA', '38': 'NDNA',
  '39': 'OHNA', '40': 'OKNA', '41': 'ORNA', '42': 'PANA', '44': 'RINA',
  '45': 'SCNA', '46': 'SDNA', '47': 'TNNA', '48': 'TXNA', '49': 'UTNA',
  '50': 'VTNA', '51': 'VANA', '53': 'WANA', '54': 'WVNA', '55': 'WINA',
  '56': 'WYNA'
};

/**
 * Fetch state employment from FRED
 * Returns total nonfarm employment for all states
 */
export async function fetchFREDEmploymentStates(
  startYear: number = 2000
): Promise<FREDAPIResponse> {
  console.log(`  Fetching FRED state employment...`);

  const allData: any[] = [];
  const startDate = `${startYear}-01-01`;

  for (const [fips, seriesId] of Object.entries(STATE_FIPS_TO_FRED_EMP)) {
    const result = await fetchFREDSeries(seriesId, startDate);
    if (result.success && result.data) {
      for (const obs of result.data) {
        if (obs.value !== '.') {  // FRED uses '.' for missing data
          allData.push({
            state_fips: fips,
            date: obs.date,
            value: obs.value
          });
        }
      }
    }
  }

  console.log(`  Fetched ${allData.length} state employment records`);
  return { success: true, data: allData };
}

/**
 * Metro CBSA to FRED employment series ID mapping
 * These are the largest metros with reliable FRED employment data
 * Format: SMU{STFIPS}{CBSA}0000000001 or similar
 */
const MAJOR_METRO_CBSA_TO_FRED_EMP: Record<string, string> = {
  // Top 50 MSAs by population with known FRED series
  '35620': 'SMU36935620000000001', // New York-Newark-Jersey City
  '31080': 'SMU06310800000000001', // Los Angeles-Long Beach-Anaheim
  '16980': 'SMU17169800000000001', // Chicago-Naperville-Elgin
  '19100': 'SMU48191000000000001', // Dallas-Fort Worth-Arlington
  '26420': 'SMU48264200000000001', // Houston-The Woodlands-Sugar Land
  '47900': 'SMU11479000000000001', // Washington-Arlington-Alexandria
  '33100': 'SMU12331000000000001', // Miami-Fort Lauderdale-Pompano Beach
  '37980': 'SMU42379800000000001', // Philadelphia-Camden-Wilmington
  '12060': 'SMU13120600000000001', // Atlanta-Sandy Springs-Alpharetta
  '14460': 'SMU25144600000000001', // Boston-Cambridge-Newton
  '38060': 'SMU04380600000000001', // Phoenix-Mesa-Chandler
  '41860': 'SMU06418600000000001', // San Francisco-Oakland-Berkeley
  '40140': 'SMU06401400000000001', // Riverside-San Bernardino-Ontario
  '19820': 'SMU26198200000000001', // Detroit-Warren-Dearborn
  '42660': 'SMU53426600000000001', // Seattle-Tacoma-Bellevue
  '33460': 'SMU27334600000000001', // Minneapolis-St. Paul-Bloomington
  '41740': 'SMU06417400000000001', // San Diego-Chula Vista-Carlsbad
  '45300': 'SMU12453000000000001', // Tampa-St. Petersburg-Clearwater
  '19740': 'SMU08197400000000001', // Denver-Aurora-Lakewood
  '41180': 'SMU29411800000000001', // St. Louis
  '12580': 'SMU24125800000000001', // Baltimore-Columbia-Towson
  '36740': 'SMU12367400000000001', // Orlando-Kissimmee-Sanford
  '16740': 'SMU37167400000000001', // Charlotte-Concord-Gastonia
  '41700': 'SMU48417000000000001', // San Antonio-New Braunfels
  '38900': 'SMU41389000000000001', // Portland-Vancouver-Hillsboro
};

/**
 * Fetch metro employment from FRED for major metros
 */
export async function fetchFREDEmploymentMetros(
  startYear: number = 2000
): Promise<FREDAPIResponse> {
  console.log(`  Fetching FRED metro employment...`);

  const allData: any[] = [];
  const startDate = `${startYear}-01-01`;

  for (const [cbsa, seriesId] of Object.entries(MAJOR_METRO_CBSA_TO_FRED_EMP)) {
    const result = await fetchFREDSeries(seriesId, startDate);
    if (result.success && result.data) {
      for (const obs of result.data) {
        if (obs.value !== '.') {
          allData.push({
            cbsa_code: cbsa,
            date: obs.date,
            value: obs.value
          });
        }
      }
    }
  }

  console.log(`  Fetched ${allData.length} metro employment records`);
  return { success: true, data: allData };
}

// ============================================================================
// FRED UNEMPLOYMENT DATA - METRO AND COUNTY (Batch Fetchers)
// ============================================================================

/**
 * Major metro CBSAs mapped to their FRED series IDs for unemployment data
 * These are short-form series IDs (e.g., HOUS448URN) that provide monthly data
 */
const METRO_UNEMPLOYMENT_SERIES: Record<string, string> = {
  '35620': 'NEWY636URN',  // New York-Newark-Jersey City
  '31080': 'LOSA106URN',  // Los Angeles-Long Beach-Anaheim
  '16980': 'CHIC917URN',  // Chicago-Naperville-Elgin
  '19100': 'DALL148URN',  // Dallas-Fort Worth-Arlington
  '26420': 'HOUS448URN',  // Houston-The Woodlands-Sugar Land
  '47900': 'WASH911URN',  // Washington-Arlington-Alexandria
  '33100': 'MIAM112URN',  // Miami-Fort Lauderdale-Pompano Beach
  '37980': 'PHIL942URN',  // Philadelphia-Camden-Wilmington
  '12060': 'ATLA013URN',  // Atlanta-Sandy Springs-Alpharetta
  '14460': 'BOST625URN',  // Boston-Cambridge-Newton (NECTA)
  '38060': 'PHOE004URN',  // Phoenix-Mesa-Chandler
  '41860': 'SANF806URN',  // San Francisco-Oakland-Berkeley
  '40140': 'RIVE806URN',  // Riverside-San Bernardino-Ontario
  '19820': 'DETR826URN',  // Detroit-Warren-Dearborn
  '42660': 'SEAT653URN',  // Seattle-Tacoma-Bellevue
  '33460': 'MINN427URN',  // Minneapolis-St. Paul-Bloomington
  '41740': 'SAND706URN',  // San Diego-Chula Vista-Carlsbad
  '45300': 'TAMP312URN',  // Tampa-St. Petersburg-Clearwater
  '19740': 'DENV708URN',  // Denver-Aurora-Lakewood
  '41180': 'STLURN',      // St. Louis
  '12580': 'BALT512URN',  // Baltimore-Columbia-Towson
  '36740': 'ORLA712URN',  // Orlando-Kissimmee-Sanford
  '16740': 'CHAR737URN',  // Charlotte-Concord-Gastonia
  '41700': 'SANA748URN',  // San Antonio-New Braunfels
  '38900': 'PORT941URN',  // Portland-Vancouver-Hillsboro
  '39580': 'RALE537URN',  // Raleigh-Cary
  '40900': 'SACR906URN',  // Sacramento-Roseville-Folsom
  '29820': 'LASV832URN',  // Las Vegas-Henderson-Paradise
  '12420': 'AUST448URN',  // Austin-Round Rock-Georgetown
  '18140': 'COLU139URN',  // Columbus, OH
  '17460': 'CLEV439URN',  // Cleveland-Elyria
  '28140': 'KANS129URN',  // Kansas City
  '26900': 'INDI918URN',  // Indianapolis-Carmel-Anderson
  '41620': 'SALT649URN',  // Salt Lake City
  '27260': 'JACK212URN',  // Jacksonville, FL
  '36420': 'OKLA440URN',  // Oklahoma City
  '32820': 'MPHURN',      // Memphis
};

/**
 * Fetch metro unemployment rates from FRED for major metros
 * Uses short-form FRED series IDs (e.g., HOUS448URN)
 */
export async function fetchFREDUnemploymentMetros(
  startYear: number = 2000
): Promise<FREDAPIResponse> {
  console.log(`  Fetching FRED metro unemployment rates...`);

  const allData: any[] = [];
  const startDate = `${startYear}-01-01`;

  for (const [cbsa, seriesId] of Object.entries(METRO_UNEMPLOYMENT_SERIES)) {
    const result = await fetchFREDSeries(seriesId, startDate);
    if (result.success && result.data && result.data.length > 0) {
      for (const obs of result.data) {
        if (obs.value !== '.') {
          allData.push({
            cbsa_code: cbsa,
            date: obs.date,
            value: obs.value
          });
        }
      }
    }
  }

  console.log(`  Fetched ${allData.length} metro unemployment records`);
  return { success: true, data: allData };
}

/**
 * Fetch county unemployment rates from FRED
 * Note: This fetches for ALL counties - takes a while but provides full coverage
 */
export async function fetchFREDUnemploymentCounties(
  startYear: number = 2000,
  stateFipsFilter?: string[]
): Promise<FREDAPIResponse> {
  console.log(`  Fetching FRED county unemployment rates...`);

  // Generate county FIPS codes - we'll fetch for all US counties
  // Format: SSCCC where SS is state FIPS, CCC is county FIPS
  const allData: any[] = [];
  const startDate = `${startYear}-01-01`;

  // Get list of state FIPS codes to process
  const statesToProcess = stateFipsFilter || Object.keys(STATE_FIPS_TO_FRED_UR);

  let totalCounties = 0;
  let successfulFetches = 0;

  for (const stateFips of statesToProcess) {
    // Each state has ~60-250 counties, we'll try common patterns
    // County FIPS are typically 001-999 but most states use 001-300
    for (let countyNum = 1; countyNum <= 350; countyNum += 2) {
      // Counties are odd numbers (001, 003, 005, etc.)
      const countyFips = countyNum.toString().padStart(3, '0');
      const fipsCode = `${stateFips}${countyFips}`;
      const seriesId = `LAUCN${fipsCode}0000000003`;

      totalCounties++;
      const result = await fetchFREDSeries(seriesId, startDate);

      if (result.success && result.data && result.data.length > 0) {
        successfulFetches++;
        for (const obs of result.data) {
          if (obs.value !== '.') {
            allData.push({
              fips_code: fipsCode,
              state_fips: stateFips,
              date: obs.date,
              value: obs.value
            });
          }
        }
      }
    }
    console.log(`    State ${stateFips}: ${successfulFetches} counties found`);
  }

  console.log(`  Fetched ${allData.length} county unemployment records from ${successfulFetches} counties`);
  return { success: true, data: allData };
}

/**
 * Fetch annual county unemployment using FRED LAUCN series
 * Format: LAUCN{5-digit-fips}0000000003A (annual data)
 * Pass in countyFipsList to fetch only specific counties (e.g., from BEA GDP data)
 */
export async function fetchFREDUnemploymentMajorCounties(
  startYear: number = 2000,
  countyFipsList?: string[]
): Promise<FREDAPIResponse> {
  console.log(`  Fetching FRED county unemployment rates (annual data)...`);

  const allData: any[] = [];
  const startDate = `${startYear}-01-01`;

  // If no county list provided, return empty - caller should pass in counties
  if (!countyFipsList || countyFipsList.length === 0) {
    console.log(`  No county FIPS list provided. Pass countyFipsList parameter.`);
    return { success: true, data: [] };
  }

  console.log(`  Processing ${countyFipsList.length} counties...`);

  let processed = 0;
  let successCount = 0;

  for (const fipsCode of countyFipsList) {
    processed++;
    if (processed % 100 === 0) {
      console.log(`    Processed ${processed}/${countyFipsList.length} counties (${successCount} successful)...`);
    }

    // Use the annual format (with 'A' suffix) which works for all counties
    const seriesId = `LAUCN${fipsCode}0000000003A`;
    const result = await fetchFREDSeries(seriesId, startDate);

    if (result.success && result.data && result.data.length > 0) {
      successCount++;
      for (const obs of result.data) {
        if (obs.value !== '.') {
          allData.push({
            fips_code: fipsCode,
            state_fips: fipsCode.substring(0, 2),
            date: obs.date,
            value: obs.value
          });
        }
      }
    }
  }

  console.log(`  Fetched ${allData.length} county unemployment records from ${successCount} counties`);
  return { success: true, data: allData };
}

// ============================================================================
// BLS API - MONTHLY COUNTY UNEMPLOYMENT (bulk fetching)
// ============================================================================

/**
 * Fetch monthly county unemployment from BLS API
 * BLS allows up to 50 series per request and 20 years max per query
 * Series format: LAUCN{5-digit-fips}0000000003 (unemployment rate)
 */
export async function fetchBLSCountyUnemployment(
  countyFipsList: string[],
  startYear: number = 2015,
  endYear: number = 2025
): Promise<FREDAPIResponse> {
  console.log(`  Fetching BLS monthly county unemployment rates...`);
  console.log(`  Processing ${countyFipsList.length} counties for years ${startYear}-${endYear}...`);

  const allData: any[] = [];
  const BATCH_SIZE = 50; // BLS allows up to 50 series per request
  const MAX_YEAR_SPAN = 20; // BLS limits to 20 years per request

  // Split counties into batches
  const batches: string[][] = [];
  for (let i = 0; i < countyFipsList.length; i += BATCH_SIZE) {
    batches.push(countyFipsList.slice(i, i + BATCH_SIZE));
  }

  // Split year range into chunks if needed
  const yearRanges: Array<{ start: number; end: number }> = [];
  for (let y = startYear; y <= endYear; y += MAX_YEAR_SPAN) {
    yearRanges.push({
      start: y,
      end: Math.min(y + MAX_YEAR_SPAN - 1, endYear)
    });
  }

  console.log(`  Split into ${batches.length} county batches, ${yearRanges.length} year range(s)`);

  let totalBatches = batches.length * yearRanges.length;
  let batchNum = 0;
  let successCount = 0;
  const seenCounties = new Set<string>();

  for (const yearRange of yearRanges) {
    console.log(`  Year range: ${yearRange.start}-${yearRange.end}`);

    for (const batch of batches) {
      batchNum++;
      if (batchNum % 20 === 0 || batchNum === 1) {
        console.log(`    Processing batch ${batchNum}/${totalBatches}...`);
      }

      // Build series IDs for this batch
      const seriesIds = batch.map(fips => `LAUCN${fips}0000000003`);

      try {
        await rateLimitWait();

        const requestBody: any = {
          seriesid: seriesIds,
          startyear: String(yearRange.start),
          endyear: String(yearRange.end),
        };
        // Only include API key if set to a real value - BLS public API works without one (limited requests)
        const blsKey = process.env.BLS_API_KEY;
        if (blsKey && !blsKey.includes('your_') && blsKey.length > 10) {
          requestBody.registrationkey = blsKey;
        }

        const response = await axios.post(`${BLS_BASE}/timeseries/data/`, requestBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        });

        if (response.data?.status === 'REQUEST_SUCCEEDED' && response.data?.Results?.series) {
          for (const series of response.data.Results.series) {
            // Extract FIPS from series ID: LAUCN{fips}0000000003
            const seriesId = series.seriesID;
            const fipsCode = seriesId.substring(5, 10); // Extract 5-digit FIPS

            if (series.data && series.data.length > 0) {
              if (!seenCounties.has(fipsCode)) {
                seenCounties.add(fipsCode);
                successCount++;
              }
              for (const obs of series.data) {
                // BLS returns year, period (M01-M12), value
                const month = obs.period.replace('M', '').padStart(2, '0');
                const date = `${obs.year}-${month}-01`;

                if (obs.value && obs.value !== '-') {
                  allData.push({
                    fips_code: fipsCode,
                    state_fips: fipsCode.substring(0, 2),
                    date: date,
                    value: obs.value
                  });
                }
              }
            }
          }
        } else if (response.data?.status !== 'REQUEST_SUCCEEDED') {
          console.log(`    Batch ${batchNum} status: ${response.data?.status}`);
          if (response.data?.message) {
            console.log(`    Message: ${response.data.message.slice(0, 2).join(', ')}`);
          }
        }
      } catch (error: any) {
        console.log(`    Batch ${batchNum} error: ${error.message}`);
      }
    }
  }

  console.log(`  Fetched ${allData.length} monthly county unemployment records from ${successCount} counties`);
  return { success: true, data: allData };
}

// ============================================================================
// BLS API - MONTHLY METRO UNEMPLOYMENT (bulk fetching)
// ============================================================================

/**
 * State abbreviation to FIPS mapping
 */
const STATE_ABBREV_TO_FIPS: Record<string, string> = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09', 'DE': '10',
  'DC': '11', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19',
  'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27',
  'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35',
  'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44',
  'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53',
  'WV': '54', 'WI': '55', 'WY': '56', 'PR': '72'
};

/**
 * Extract the principal state from a CBSA title
 * Handles formats like:
 * - "Austin-Round Rock-Georgetown, TX" -> "TX" -> "48"
 * - "Allentown-Bethlehem-Easton, PA-NJ (Metropolitan Statistical Area)" -> "PA" -> "42"
 * Multi-state metros use the first listed state
 */
function getStateFipsFromCbsaTitle(cbsaTitle: string): string | null {
  // Pattern 1: BEA format with "(Metropolitan Statistical Area)" suffix
  // e.g., "City-City, ST-ST (Metropolitan Statistical Area)"
  let match = cbsaTitle.match(/,\s*([A-Z]{2})(?:-[A-Z]{2})*\s*\(/);
  if (match) {
    const stateAbbrev = match[1];
    return STATE_ABBREV_TO_FIPS[stateAbbrev] || null;
  }

  // Pattern 2: Simple format without suffix
  // e.g., "City-City, ST" or "City-City, ST-ST-ST"
  match = cbsaTitle.match(/,\s*([A-Z]{2})(?:-[A-Z]{2})*\s*$/);
  if (match) {
    const stateAbbrev = match[1];
    return STATE_ABBREV_TO_FIPS[stateAbbrev] || null;
  }

  return null;
}

/**
 * Fetch monthly metro unemployment from BLS API
 * BLS allows up to 50 series per request
 * Series format: LAUMT{state_fips}{cbsa_code}00000003 (unemployment rate)
 */
export async function fetchBLSMetroUnemployment(
  metros: Array<{ cbsa_code: string; cbsa_title: string }>,
  startYear: number = 2015,
  endYear: number = 2025
): Promise<FREDAPIResponse> {
  console.log(`  Fetching BLS monthly metro unemployment rates...`);
  console.log(`  Processing ${metros.length} metros for years ${startYear}-${endYear}...`);

  // Build list of metros with state FIPS
  const metrosWithState: Array<{ cbsa: string; state: string; title: string }> = [];
  for (const metro of metros) {
    const stateFips = getStateFipsFromCbsaTitle(metro.cbsa_title);
    if (stateFips) {
      metrosWithState.push({
        cbsa: metro.cbsa_code,
        state: stateFips,
        title: metro.cbsa_title
      });
    }
  }

  console.log(`  Found ${metrosWithState.length} metros with valid state FIPS`);

  const allData: any[] = [];
  const BATCH_SIZE = 50;
  const MAX_YEAR_SPAN = 20;

  // Split metros into batches
  const batches: typeof metrosWithState[] = [];
  for (let i = 0; i < metrosWithState.length; i += BATCH_SIZE) {
    batches.push(metrosWithState.slice(i, i + BATCH_SIZE));
  }

  // Split year range into chunks if needed
  const yearRanges: Array<{ start: number; end: number }> = [];
  for (let y = startYear; y <= endYear; y += MAX_YEAR_SPAN) {
    yearRanges.push({
      start: y,
      end: Math.min(y + MAX_YEAR_SPAN - 1, endYear)
    });
  }

  console.log(`  Split into ${batches.length} metro batches, ${yearRanges.length} year range(s)`);

  let totalBatches = batches.length * yearRanges.length;
  let batchNum = 0;
  let successCount = 0;
  const seenMetros = new Set<string>();

  for (const yearRange of yearRanges) {
    console.log(`  Year range: ${yearRange.start}-${yearRange.end}`);

    for (const batch of batches) {
      batchNum++;

      if (batchNum % 20 === 1 || batchNum === totalBatches) {
        console.log(`    Processing batch ${batchNum}/${totalBatches}...`);
      }

      // Build series IDs: LAUMT{state}{cbsa}00000003
      const seriesIds = batch.map(m => `LAUMT${m.state}${m.cbsa}00000003`);

      const requestBody: any = {
        seriesid: seriesIds,
        startyear: String(yearRange.start),
        endyear: String(yearRange.end),
      };

      const blsKey = process.env.BLS_API_KEY;
      if (blsKey && !blsKey.includes('your_') && blsKey.length > 10) {
        requestBody.registrationkey = blsKey;
      }

      try {
        const response = await axios.post(`${BLS_BASE}/timeseries/data/`, requestBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        });

        if (response.data?.status === 'REQUEST_SUCCEEDED' && response.data?.Results?.series) {
          for (const series of response.data.Results.series) {
            const seriesId = series.seriesID;
            // Extract CBSA from series ID: LAUMT{state:2}{cbsa:5}00000003
            const cbsaCode = seriesId.substring(7, 12);

            if (series.data && series.data.length > 0) {
              if (!seenMetros.has(cbsaCode)) {
                seenMetros.add(cbsaCode);
                successCount++;
              }
              for (const obs of series.data) {
                const month = obs.period.replace('M', '').padStart(2, '0');
                const date = `${obs.year}-${month}-01`;

                if (obs.value && obs.value !== '-') {
                  allData.push({
                    cbsa_code: cbsaCode,
                    date: date,
                    value: obs.value
                  });
                }
              }
            }
          }
        } else if (response.data?.status !== 'REQUEST_SUCCEEDED') {
          console.log(`    Batch ${batchNum} status: ${response.data?.status}`);
          if (response.data?.message) {
            console.log(`    Message: ${response.data.message.slice(0, 2).join(', ')}`);
          }
        }
      } catch (error: any) {
        console.log(`    Batch ${batchNum} error: ${error.message}`);
      }
    }
  }

  console.log(`  Fetched ${allData.length} monthly metro unemployment records from ${successCount} metros`);
  return { success: true, data: allData };
}
