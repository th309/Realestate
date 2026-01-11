/**
 * FRED API Importer Type Definitions
 */

export interface FREDSeries {
  seriesId: string | ((geoid: string) => string | null);
  field: string;
  description: string;
  geography: FREDGeography;
  transform?: (value: number) => number;
}

export interface ImportStats {
  geography: string;
  year: number;
  totalRecords: number;
  seriesProcessed: number;
  errors: string[];
  duration: number;
}

export type FREDGeography = 'state' | 'county' | 'msa' | 'national';

export const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

// PostgreSQL INTEGER limits
export const MAX_INTEGER = 2147483647;
export const MIN_INTEGER = -2147483648;
