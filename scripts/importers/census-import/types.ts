/**
 * Census API Importer Type Definitions
 */

export interface CensusVariable {
  code: string;
  description: string;
  table: 'demographics' | 'economics' | 'housing';
  column: string;
  transform?: (value: string) => number | null;
}

export interface ImportStats {
  geography: string;
  year: number;
  totalRecords: number;
  demographics: number;
  economics: number;
  housing: number;
  errors: string[];
  duration: number;
}

export type CensusGeography = 'zip' | 'county' | 'state';

export const CENSUS_BASE_URL = 'https://api.census.gov/data';

// PostgreSQL INTEGER limits
export const MAX_INTEGER = 2147483647;
export const MIN_INTEGER = -2147483648;
