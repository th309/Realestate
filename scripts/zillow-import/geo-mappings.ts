/**
 * Geographic Code Mappings
 *
 * Provides mappings between Zillow internal IDs and standard geographic codes:
 * - State: Zillow RegionID → State Name (for map lookup by name)
 * - Metro: Zillow RegionID → CBSA Code (5-digit)
 * - County: Uses FIPS directly from CSV (StateCodeFIPS + MunicipalCodeFIPS)
 * - Zip: Uses ZIP code directly from RegionName
 */

import { parse } from 'csv-parse/sync';

// Zillow RegionID to State Name mapping (for state-level data)
export const ZILLOW_STATE_MAP: Record<string, string> = {
  '3': 'Alaska',
  '4': 'Alabama',
  '6': 'Arkansas',
  '8': 'Arizona',
  '9': 'California',
  '10': 'Colorado',
  '11': 'Connecticut',
  '12': 'District of Columbia',
  '13': 'Delaware',
  '14': 'Florida',
  '16': 'Georgia',
  '18': 'Hawaii',
  '19': 'Iowa',
  '20': 'Idaho',
  '21': 'Illinois',
  '22': 'Indiana',
  '23': 'Kansas',
  '24': 'Kentucky',
  '25': 'Louisiana',
  '26': 'Massachusetts',
  '27': 'Maryland',
  '28': 'Maine',
  '30': 'Michigan',
  '31': 'Minnesota',
  '32': 'Missouri',
  '34': 'Mississippi',
  '35': 'Montana',
  '36': 'North Carolina',
  '37': 'North Dakota',
  '38': 'Nebraska',
  '39': 'New Hampshire',
  '40': 'New Jersey',
  '41': 'New Mexico',
  '42': 'Nevada',
  '43': 'New York',
  '44': 'Ohio',
  '45': 'Oklahoma',
  '46': 'Oregon',
  '47': 'Pennsylvania',
  '50': 'Rhode Island',
  '51': 'South Carolina',
  '52': 'South Dakota',
  '53': 'Tennessee',
  '54': 'Texas',
  '55': 'Utah',
  '56': 'Virginia',
  '58': 'Vermont',
  '59': 'Washington',
  '60': 'Wisconsin',
  '61': 'West Virginia',
  '62': 'Wyoming',
};

// Cache for metro mapping (loaded from Zillow crosswalk file)
let metroMappingCache: Map<string, string> | null = null;

/**
 * Load metro mapping from Zillow's official crosswalk file
 * Maps Zillow MetroRegionID to CBSA code
 */
export async function loadMetroMapping(): Promise<Map<string, string>> {
  if (metroMappingCache) {
    return metroMappingCache;
  }

  console.log('Loading metro mapping from Zillow crosswalk file...');
  const response = await fetch(
    'http://files.zillowstatic.com/research/public/CountyCrossWalk_Zillow.csv'
  );
  const text = await response.text();

  const records = parse(text, { columns: true, skip_empty_lines: true });

  const mapping = new Map<string, string>();
  for (const record of records) {
    const zillowId = record.MetroRegionID_Zillow;
    const cbsa = record.CBSACode;
    if (zillowId && cbsa && !mapping.has(zillowId)) {
      mapping.set(zillowId, cbsa);
    }
  }

  console.log(`Loaded ${mapping.size} metro mappings`);
  metroMappingCache = mapping;
  return mapping;
}

/**
 * Get state name from Zillow RegionID
 */
export function getStateName(zillowRegionId: string): string | undefined {
  return ZILLOW_STATE_MAP[zillowRegionId];
}

/**
 * Get CBSA code from Zillow Metro RegionID
 */
export async function getCbsaCode(zillowMetroId: string): Promise<string | undefined> {
  const mapping = await loadMetroMapping();
  return mapping.get(zillowMetroId);
}

/**
 * Build FIPS code from state and county FIPS components
 */
export function buildCountyFips(stateCodeFips: string, municipalCodeFips: string): string {
  return String(stateCodeFips).padStart(2, '0') + String(municipalCodeFips).padStart(3, '0');
}
