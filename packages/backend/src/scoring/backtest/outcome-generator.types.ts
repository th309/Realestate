/**
 * Types and pure utility functions for the outcome generator pipeline.
 */

import type { ScoreType, GeographyType } from '../scoring.types';

export interface OutcomeMetrics {
  priceChange?: number;
  priceCagr?: number;
  priceVolatility?: number;
  rentChange?: number;
  rentCagr?: number;
  capRateChange?: number;
  totalReturn?: number;
  daysOnMarketChange?: number;
  inventoryChange?: number;
  transactionVolumeChange?: number;
}

export interface BenchmarkReturns {
  stateReturn1y?: number;
  stateReturn3yCagr?: number;
  stateReturn5yCagr?: number;
  nationalReturn1y?: number;
  nationalReturn3yCagr?: number;
  nationalReturn5yCagr?: number;
  excessVsState1y?: number;
  excessVsState3y?: number;
  excessVsState5y?: number;
  excessVsNational1y?: number;
  excessVsNational3y?: number;
  excessVsNational5y?: number;
  rentReturn1y?: number;
  rentReturn3yCagr?: number;
  stateRentReturn1y?: number;
  stateRentReturn3yCagr?: number;
  nationalRentReturn1y?: number;
  nationalRentReturn3yCagr?: number;
}

export interface OutcomeRecord {
  geographyId: string;
  geographyType: GeographyType;
  scoreType: ScoreType;
  scoreDate: string;
  scoreValue: number | null;
  stateCode?: string;
  outcome6m?: OutcomeMetrics;
  outcome1y?: OutcomeMetrics;
  outcome3y?: OutcomeMetrics;
  outcome5y?: OutcomeMetrics;
  benchmarks?: BenchmarkReturns;
}

export interface HistoricalDataPoint {
  date: string;
  zhvi?: number;
  zori?: number;
  daysOnMarket?: number;
  inventory?: number;
  transactionVolume?: number;
  source?: 'zillow' | 'redfin' | 'realtor';
}

export interface BenchmarkData {
  zhvi?: number;
  zori?: number;
}

export interface TableRoute {
  table: string;
  idColumn: string;
  dateColumn: string;
}

/** Calculate a future date from a start date and horizon string */
export function calculateOutcomeDate(
  startDate: string,
  horizon: string,
): string {
  const date = new Date(startDate);

  switch (horizon) {
    case '6m':
      date.setMonth(date.getMonth() + 6);
      break;
    case '1y':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case '3y':
      date.setFullYear(date.getFullYear() + 3);
      break;
    case '5y':
      date.setFullYear(date.getFullYear() + 5);
      break;
  }

  return date.toISOString().split('T')[0];
}

// Table routing helpers

export function getZillowTable(geographyType: string): string {
  switch (geographyType) {
    case 'state':
      return 'zillow_state';
    case 'metro':
      return 'zillow_metro';
    case 'county':
      return 'zillow_county';
    case 'city':
      return 'zillow_city';
    case 'zip':
      return 'zillow_zip';
    default:
      return 'zillow_metro';
  }
}

export function getZillowIdColumn(geographyType: string): string {
  switch (geographyType) {
    case 'state':
      return 'state_code';
    case 'metro':
      return 'cbsa_code';
    case 'county':
      return 'fips_code';
    case 'zip':
      return 'region_name';
    default:
      return 'cbsa_code';
  }
}

export function getRedfinRoute(geographyType: string): TableRoute | null {
  switch (geographyType) {
    case 'metro':
      return {
        table: 'redfin_metro',
        idColumn: 'cbsa_code',
        dateColumn: 'period_end',
      };
    case 'county':
      return {
        table: 'redfin_county',
        idColumn: 'fips_code',
        dateColumn: 'period_end',
      };
    case 'zip':
      return {
        table: 'redfin_zip',
        idColumn: 'zip_code',
        dateColumn: 'period_end',
      };
    default:
      return null;
  }
}

export function getRealtorRoute(geographyType: string): TableRoute | null {
  switch (geographyType) {
    case 'metro':
      return {
        table: 'realtor_metro',
        idColumn: 'cbsa_code',
        dateColumn: 'period_date',
      };
    case 'county':
      return {
        table: 'realtor_county',
        idColumn: 'county_fips',
        dateColumn: 'period_date',
      };
    case 'zip':
      return {
        table: 'realtor_zip',
        idColumn: 'postal_code',
        dateColumn: 'period_date',
      };
    default:
      return null;
  }
}

/** Calculate percentage return and CAGR between two values */
export function calculateReturn(
  startValue: number | undefined,
  endValue: number | undefined,
  years: number,
): { change: number; cagr: number } | null {
  if (!startValue || !endValue || startValue === 0) return null;

  const change = ((endValue - startValue) / startValue) * 100;
  const cagr =
    years >= 1
      ? (Math.pow(endValue / startValue, 1 / years) - 1) * 100
      : change;

  return { change, cagr };
}
