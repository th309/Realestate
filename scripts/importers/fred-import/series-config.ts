/**
 * FRED Series Configurations
 */

import type { FREDSeries } from './types';
import { getStateAbbreviation } from './state-mappings';

/**
 * FRED Series ID mappings to database fields
 */
export const FRED_SERIES: FREDSeries[] = [
  // National level series
  {
    seriesId: 'UNRATE',
    field: 'unemployment_rate',
    description: 'Unemployment Rate (National)',
    geography: 'national'
  },
  {
    seriesId: 'PAYEMS',
    field: 'employment_total',
    description: 'Total Nonfarm Payrolls (National)',
    geography: 'national'
  },
  {
    seriesId: 'MEHOINUSA646N',
    field: 'median_household_income',
    description: 'Median Household Income (National)',
    geography: 'national'
  },
  {
    seriesId: 'GDP',
    field: 'gdp_millions',
    description: 'Gross Domestic Product (National)',
    geography: 'national',
    transform: (v) => v / 1000 // Convert billions to millions
  },
  {
    seriesId: 'MORTGAGE30US',
    field: 'mortgage_rate_30yr',
    description: '30-Year Fixed Rate Mortgage (National)',
    geography: 'national'
  },

  // State-level series
  {
    seriesId: (geoid: string) => {
      const stateAbbrev = getStateAbbreviation(geoid);
      return stateAbbrev ? `${stateAbbrev}UR` : null;
    },
    field: 'unemployment_rate',
    description: 'State Unemployment Rate',
    geography: 'state'
  },
];

/**
 * Get series for a specific geography
 */
export function getSeriesForGeography(geography: string): FREDSeries[] {
  return FRED_SERIES.filter(s => s.geography === geography || s.geography === 'national');
}

/**
 * Field to series suffix mapping for state-level data
 */
export const FIELD_TO_SUFFIX: Record<string, string> = {
  'unemployment_rate': 'UR',
  'employment_total': 'PAYEMS',
  'median_household_income': 'MEHOIN',
};
