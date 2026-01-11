/**
 * Census API Client
 */

import type { CensusGeography } from './types';
import { CENSUS_BASE_URL } from './types';
import { getCensusApiKey } from './db-client';

const GEOGRAPHY_MAP: Record<CensusGeography, string> = {
  zip: 'zip%20code%20tabulation%20area:*',
  county: 'county:*',
  state: 'state:*'
};

/**
 * Fetch data from Census Bureau API
 */
export async function fetchCensusData(
  year: number,
  geography: CensusGeography,
  variables: string[]
): Promise<any[]> {
  const apiKey = getCensusApiKey();
  const variableList = variables.join(',');
  const url = `${CENSUS_BASE_URL}/${year}/acs/acs5?get=${variableList}&for=${GEOGRAPHY_MAP[geography]}&key=${apiKey}`;

  console.log(`Fetching ${geography} data for ${year}...`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Census API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // First row is headers, rest is data
    const [headers, ...rows] = data;

    return rows.map((row: any[]) => {
      const record: any = {};
      headers.forEach((header: string, index: number) => {
        record[header] = row[index];
      });
      return record;
    });
  } catch (error: any) {
    throw new Error(`Failed to fetch Census data: ${error.message}`);
  }
}

/**
 * Get GEOID from record based on geography type
 */
export function getGeoIdFromRecord(record: any, geography: CensusGeography): string {
  switch (geography) {
    case 'zip':
      return record['zip code tabulation area']?.padStart(5, '0') || record['zip code tabulation area'];
    case 'county':
      const stateFips = record.state?.padStart(2, '0') || record.state;
      const countyFips = record.county?.padStart(3, '0') || record.county;
      return `${stateFips}${countyFips}`;
    case 'state':
      return record.state?.padStart(2, '0') || record.state;
  }
}
