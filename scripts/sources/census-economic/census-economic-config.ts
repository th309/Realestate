/**
 * Configuration for Census and Economic data imports.
 *
 * Defines database tables, conflict keys, Census ACS variable codes,
 * state FIPS/name/abbreviation mappings, and shared constants used
 * by all four API clients (Census, BEA, FRED, BLS).
 */

// ---------------------------------------------------------------------------
// Census ACS 5-Year variable codes -> metric names
// ---------------------------------------------------------------------------

export const ACS_VARIABLES: Record<string, string> = {
  B01003_001E: 'total_population',
  B01002_001E: 'median_age',
  B19013_001E: 'median_household_income',
  B19301_001E: 'per_capita_income',
  B25001_001E: 'total_housing_units',
  B25003_001E: 'total_occupied_units',
  B25003_002E: 'owner_occupied_units',
  B25003_003E: 'renter_occupied_units',
  B25077_001E: 'median_home_value',
  B25064_001E: 'median_gross_rent',
  B25071_001E: 'rent_as_pct_of_income',
};

// ---------------------------------------------------------------------------
// Census ACS year range
// ---------------------------------------------------------------------------

export const CENSUS_YEARS_FULL = [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010];
export const CENSUS_YEARS_QUICK = [2023, 2022];

// ---------------------------------------------------------------------------
// Large states for city/place download (top 10 by population)
// ---------------------------------------------------------------------------

export const LARGE_STATE_FIPS = ['06', '48', '12', '36', '42', '17', '39', '13', '37', '26'];

// ---------------------------------------------------------------------------
// Census geography types (as the Census API expects them)
// ---------------------------------------------------------------------------

export type CensusGeoType =
  | 'us'
  | 'state'
  | 'metropolitan statistical area/micropolitan statistical area'
  | 'county'
  | 'place'
  | 'zip code tabulation area';

// ---------------------------------------------------------------------------
// Database table definitions
// ---------------------------------------------------------------------------

export interface CensusEconomicTable {
  tableName: string;
  conflictKeys: string[];
}

export const CENSUS_TABLES: Record<string, CensusEconomicTable> = {
  national: { tableName: 'census_national', conflictKeys: ['year'] },
  state:    { tableName: 'census_state',    conflictKeys: ['year', 'state_fips'] },
  metro:    { tableName: 'census_metro',    conflictKeys: ['year', 'cbsa_code'] },
  county:   { tableName: 'census_county',   conflictKeys: ['year', 'fips_code'] },
  city:     { tableName: 'census_city',     conflictKeys: ['year', 'place_fips'] },
  zip:      { tableName: 'census_zip',      conflictKeys: ['year', 'zcta'] },
};

export const ECONOMIC_TABLES: Record<string, CensusEconomicTable> = {
  national: { tableName: 'economic_national', conflictKeys: ['period_date'] },
  state:    { tableName: 'economic_state',    conflictKeys: ['period_date', 'state_fips'] },
  metro:    { tableName: 'economic_metro',    conflictKeys: ['period_date', 'cbsa_code'] },
  county:   { tableName: 'economic_county',   conflictKeys: ['period_date', 'fips_code'] },
};

// ---------------------------------------------------------------------------
// State FIPS mappings
// ---------------------------------------------------------------------------

export const STATE_FIPS_TO_NAME: Record<string, string> = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas', '06': 'California',
  '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware', '11': 'District of Columbia', '12': 'Florida',
  '13': 'Georgia', '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois', '18': 'Indiana',
  '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
  '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota', '28': 'Mississippi',
  '29': 'Missouri', '30': 'Montana', '31': 'Nebraska', '32': 'Nevada', '33': 'New Hampshire',
  '34': 'New Jersey', '35': 'New Mexico', '36': 'New York', '37': 'North Carolina', '38': 'North Dakota',
  '39': 'Ohio', '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
  '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas', '49': 'Utah',
  '50': 'Vermont', '51': 'Virginia', '53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin',
  '56': 'Wyoming', '72': 'Puerto Rico',
};

export const STATE_FIPS_TO_ABBREV: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY', '72': 'PR',
};

export const STATE_ABBREV_TO_FIPS: Record<string, string> = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09', 'DE': '10',
  'DC': '11', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19',
  'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27',
  'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35',
  'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44',
  'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53',
  'WV': '54', 'WI': '55', 'WY': '56', 'PR': '72',
};

// ---------------------------------------------------------------------------
// Rate limiter shared across all API clients
// ---------------------------------------------------------------------------

let lastRequestTimeMs = 0;
const RATE_LIMIT_MS = 500;

export async function rateLimitWait(): Promise<void> {
  const elapsed = Date.now() - lastRequestTimeMs;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTimeMs = Date.now();
}

// ---------------------------------------------------------------------------
// Compute homeownership rate from occupied/owner counts
// ---------------------------------------------------------------------------

export function computeHomeownershipRate(ownerOccupied: string | null, totalOccupied: string | null): number | null {
  if (!ownerOccupied || !totalOccupied) return null;
  const owner = parseFloat(ownerOccupied);
  const total = parseFloat(totalOccupied);
  if (isNaN(owner) || isNaN(total) || total === 0) return null;
  return parseFloat(((owner / total) * 100).toFixed(2));
}
