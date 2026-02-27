/**
 * Outcome Generator Types — Pure Function Unit Tests
 *
 * Tests for all exported utility functions in outcome-generator.types.ts:
 * - calculateOutcomeDate: date arithmetic for score horizons
 * - calculateReturn: percentage change and CAGR between two values
 * - getZillowTable / getZillowIdColumn: Zillow table routing
 * - getRedfinRoute / getRealtorRoute: Redfin/Realtor table routing
 */

import {
  calculateOutcomeDate,
  calculateReturn,
  getZillowTable,
  getZillowIdColumn,
  getRedfinRoute,
  getRealtorRoute,
} from '../../../backtest/outcome-generator.types';

describe('calculateOutcomeDate', () => {
  const BASE_DATE = '2021-06-15';

  it('adds 6 months for the 6m horizon', () => {
    expect(calculateOutcomeDate(BASE_DATE, '6m')).toBe('2021-12-15');
  });

  it('adds 1 year for the 1y horizon', () => {
    expect(calculateOutcomeDate(BASE_DATE, '1y')).toBe('2022-06-15');
  });

  it('adds 3 years for the 3y horizon', () => {
    expect(calculateOutcomeDate(BASE_DATE, '3y')).toBe('2024-06-15');
  });

  it('adds 5 years for the 5y horizon', () => {
    expect(calculateOutcomeDate(BASE_DATE, '5y')).toBe('2026-06-15');
  });

  it('returns the same date for an unrecognized horizon', () => {
    expect(calculateOutcomeDate(BASE_DATE, '2y')).toBe(BASE_DATE);
  });

  it('handles month overflow correctly when adding 6 months', () => {
    // August + 6 months = next year February
    expect(calculateOutcomeDate('2021-08-15', '6m')).toBe('2022-02-15');
  });

  it('handles leap year boundary for 1y horizon', () => {
    // 2024 is a leap year
    expect(calculateOutcomeDate('2024-02-29', '1y')).toBe('2025-03-01');
  });

  it('handles January 31 + 6 months (JS Date month overflow)', () => {
    // JS Date: new Date('2021-01-31').setMonth(1+6) → month 7 = August,
    // but day 31 overflows August → rolls to Jul 31? Actually Jul 30.
    // setMonth(7) on Jan 31 → "Feb 31" overflow → Mar 3, then +6 more...
    // In practice: Jan 31 + 6m = Jul 30 due to intermediate Feb overflow
    expect(calculateOutcomeDate('2021-01-31', '6m')).toBe('2021-07-30');
  });
});

describe('calculateReturn', () => {
  it('calculates percentage change and CAGR for 1-year period', () => {
    const result = calculateReturn(100000, 110000, 1);
    expect(result).not.toBeNull();
    expect(result!.change).toBeCloseTo(10, 5);
    expect(result!.cagr).toBeCloseTo(10, 5);
  });

  it('calculates CAGR correctly for multi-year periods', () => {
    // $100K → $121K over 2 years = 10% CAGR
    const result = calculateReturn(100000, 121000, 2);
    expect(result).not.toBeNull();
    expect(result!.change).toBeCloseTo(21, 5);
    expect(result!.cagr).toBeCloseTo(10, 0);
  });

  it('returns raw change (not CAGR) for sub-year periods', () => {
    // years < 1 means CAGR = change
    const result = calculateReturn(100000, 105000, 0.5);
    expect(result).not.toBeNull();
    expect(result!.change).toBeCloseTo(5, 5);
    expect(result!.cagr).toBeCloseTo(5, 5);
  });

  it('returns null when startValue is undefined', () => {
    expect(calculateReturn(undefined, 110000, 1)).toBeNull();
  });

  it('returns null when endValue is undefined', () => {
    expect(calculateReturn(100000, undefined, 1)).toBeNull();
  });

  it('returns null when startValue is zero', () => {
    expect(calculateReturn(0, 110000, 1)).toBeNull();
  });

  it('handles negative returns correctly', () => {
    const result = calculateReturn(100000, 90000, 1);
    expect(result).not.toBeNull();
    expect(result!.change).toBeCloseTo(-10, 5);
    expect(result!.cagr).toBeCloseTo(-10, 5);
  });

  it('handles very large returns', () => {
    const result = calculateReturn(100000, 200000, 1);
    expect(result).not.toBeNull();
    expect(result!.change).toBeCloseTo(100, 5);
  });
});

describe('getZillowTable', () => {
  it('returns zillow_state for state geography', () => {
    expect(getZillowTable('state')).toBe('zillow_state');
  });

  it('returns zillow_metro for metro geography', () => {
    expect(getZillowTable('metro')).toBe('zillow_metro');
  });

  it('returns zillow_county for county geography', () => {
    expect(getZillowTable('county')).toBe('zillow_county');
  });

  it('returns zillow_city for city geography', () => {
    expect(getZillowTable('city')).toBe('zillow_city');
  });

  it('returns zillow_zip for zip geography', () => {
    expect(getZillowTable('zip')).toBe('zillow_zip');
  });

  it('defaults to zillow_metro for unknown geography type', () => {
    expect(getZillowTable('neighborhood')).toBe('zillow_metro');
  });
});

describe('getZillowIdColumn', () => {
  it('returns state_code for state geography', () => {
    expect(getZillowIdColumn('state')).toBe('state_code');
  });

  it('returns cbsa_code for metro geography', () => {
    expect(getZillowIdColumn('metro')).toBe('cbsa_code');
  });

  it('returns fips_code for county geography', () => {
    expect(getZillowIdColumn('county')).toBe('fips_code');
  });

  it('returns region_name for zip geography', () => {
    expect(getZillowIdColumn('zip')).toBe('region_name');
  });

  it('defaults to cbsa_code for unknown geography type', () => {
    expect(getZillowIdColumn('neighborhood')).toBe('cbsa_code');
  });
});

describe('getRedfinRoute', () => {
  it('returns correct route for metro geography', () => {
    expect(getRedfinRoute('metro')).toEqual({
      table: 'redfin_metro',
      idColumn: 'cbsa_code',
      dateColumn: 'period_end',
    });
  });

  it('returns correct route for county geography', () => {
    expect(getRedfinRoute('county')).toEqual({
      table: 'redfin_county',
      idColumn: 'fips_code',
      dateColumn: 'period_end',
    });
  });

  it('returns correct route for zip geography', () => {
    expect(getRedfinRoute('zip')).toEqual({
      table: 'redfin_zip',
      idColumn: 'zip_code',
      dateColumn: 'period_end',
    });
  });

  it('returns null for state geography (no Redfin state data)', () => {
    expect(getRedfinRoute('state')).toBeNull();
  });

  it('returns null for unknown geography type', () => {
    expect(getRedfinRoute('neighborhood')).toBeNull();
  });
});

describe('getRealtorRoute', () => {
  it('returns correct route for metro geography', () => {
    expect(getRealtorRoute('metro')).toEqual({
      table: 'realtor_metro',
      idColumn: 'cbsa_code',
      dateColumn: 'period_date',
    });
  });

  it('returns correct route for county geography', () => {
    expect(getRealtorRoute('county')).toEqual({
      table: 'realtor_county',
      idColumn: 'county_fips',
      dateColumn: 'period_date',
    });
  });

  it('returns correct route for zip geography', () => {
    expect(getRealtorRoute('zip')).toEqual({
      table: 'realtor_zip',
      idColumn: 'postal_code',
      dateColumn: 'period_date',
    });
  });

  it('returns null for state geography (no Realtor state data)', () => {
    expect(getRealtorRoute('state')).toBeNull();
  });

  it('returns null for unknown geography type', () => {
    expect(getRealtorRoute('neighborhood')).toBeNull();
  });
});
