/**
 * Record Processors for Census Data
 */

import { parseInteger, parseNumeric, parseValue, safeNumeric, safePercentage, calculatePercentage } from './parsers';
import { MAX_INTEGER } from './types';

/**
 * Process demographics record
 */
export function processDemographicsRecord(record: any, geoid: string, year: number): any {
  const totalPop = parseInteger(record['B01001_001E']);
  const under5Male = parseInteger(record['B01001_003E']);
  const under5Female = parseInteger(record['B01001_027E']);
  const age18_34Male = parseInteger(record['B01001_007E']);
  const age18_34Female = parseInteger(record['B01001_031E']);
  const age35_54Male = parseInteger(record['B01001_011E']);
  const age35_54Female = parseInteger(record['B01001_035E']);
  const age65PlusMale = parseInteger(record['B01001_020E']);
  const age65PlusFemale = parseInteger(record['B01001_044E']);

  const bachelors = parseInteger(record['B15003_022E']);
  const masters = parseInteger(record['B15003_023E']);
  const professional = parseInteger(record['B15003_024E']);
  const doctorate = parseInteger(record['B15003_025E']);

  const totalGrad = (masters || 0) + (professional || 0) + (doctorate || 0);
  const pop25Plus = totalPop;

  return {
    geoid,
    vintage_year: year,
    survey_type: 'acs5',
    total_population: totalPop,
    median_age: safeNumeric(record['B01002_001E'], 0, 120),
    total_households: parseInteger(record['B11001_001E']),
    avg_household_size: safeNumeric(record['B25010_001E'], 0, 20),
    population_under_18_pct: safePercentage((under5Male || 0) + (under5Female || 0), totalPop),
    population_18_34_pct: safePercentage((age18_34Male || 0) + (age18_34Female || 0), totalPop),
    population_35_54_pct: safePercentage((age35_54Male || 0) + (age35_54Female || 0), totalPop),
    population_65_plus_pct: safePercentage((age65PlusMale || 0) + (age65PlusFemale || 0), totalPop),
    bachelors_degree_pct: safePercentage(bachelors, pop25Plus),
    graduate_degree_pct: safePercentage(totalGrad, pop25Plus),
    created_at: new Date().toISOString()
  };
}

/**
 * Process economics record
 */
export function processEconomicsRecord(record: any, geoid: string, year: number): any {
  const povertyCount = parseInteger(record['B17001_002E']);
  const totalPop = parseInteger(record['B01001_001E']);
  const unemployed = parseInteger(record['B23025_005E']);
  const laborForce = parseInteger(record['B23025_003E']);

  return {
    geoid,
    vintage_year: year,
    median_household_income: parseNumeric(record['B19013_001E'], 999999999999),
    per_capita_income: parseNumeric(record['B19301_001E'], 999999999999),
    poverty_rate_all: calculatePercentage(povertyCount, totalPop),
    unemployment_rate: calculatePercentage(unemployed, laborForce),
    gini_index: (() => {
      const gini = parseValue(record['B19083_001E']);
      if (gini === null) return null;
      if (gini > 1) return Math.min(1, gini / 100);
      return Math.max(0, Math.min(1, gini));
    })(),
    created_at: new Date().toISOString()
  };
}

/**
 * Process housing record
 */
export function processHousingRecord(record: any, geoid: string, year: number): any {
  const totalUnits = parseInteger(record['B25001_001E']);
  const occupied = parseInteger(record['B25002_002E']);
  const ownerOccupied = parseInteger(record['B25003_002E']);

  const vacancyRate = calculatePercentage(
    totalUnits && occupied ? totalUnits - occupied : null,
    totalUnits
  );
  const homeownershipRate = calculatePercentage(ownerOccupied, occupied);

  const yearBuilt = parseInteger(record['B25035_001E']);
  const cappedYearBuilt = yearBuilt && yearBuilt > 1800 && yearBuilt < 2100 ? yearBuilt : null;

  return {
    geoid,
    vintage_year: year,
    total_housing_units: totalUnits,
    occupied_units: occupied,
    vacancy_rate: vacancyRate,
    homeownership_rate: homeownershipRate,
    median_home_value: parseNumeric(record['B25077_001E'], 999999999999),
    median_gross_rent: parseNumeric(record['B25064_001E'], 1000000),
    median_year_built: cappedYearBuilt,
    created_at: new Date().toISOString()
  };
}

/**
 * Ultra clean a record to ensure all values are database-safe
 */
export function ultraCleanRecord(record: any): any {
  const cleaned: any = {};

  Object.keys(record).forEach(key => {
    const value = record[key];

    if (value === null || value === undefined) {
      cleaned[key] = null;
    } else if (typeof value === 'number') {
      if (!isFinite(value) || isNaN(value)) {
        cleaned[key] = null;
      } else if (key.includes('pct') || key.includes('rate')) {
        cleaned[key] = Math.max(0, Math.min(100, Math.round(value * 10000) / 10000));
      } else if (key.includes('age')) {
        cleaned[key] = Math.max(0, Math.min(120, Math.round(value)));
      } else if (key.includes('size')) {
        cleaned[key] = Math.max(0, Math.min(20, Math.round(value * 100) / 100));
      } else if (key.includes('population') || key.includes('household')) {
        cleaned[key] = Math.max(0, Math.min(MAX_INTEGER, Math.round(value)));
      } else {
        const capped = Math.max(-999999999999, Math.min(999999999999, value));
        cleaned[key] = isFinite(capped) ? capped : null;
      }
    } else {
      cleaned[key] = value;
    }
  });

  return cleaned;
}
