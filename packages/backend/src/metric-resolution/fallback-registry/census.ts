/**
 * Census / demographic metrics — ACS-derived figures including population,
 * income, age, homeownership, and YoY growth rates.
 */

import { MetricFallbackChain } from '../metric-resolution.types';

export const censusMetrics: Record<string, MetricFallbackChain> = {
  population: {
    metricId: 'population',
    sources: [{ source: 'census', column: 'total_population' }],
    supportsGeoInheritance: false,
  },

  median_income: {
    metricId: 'median_income',
    sources: [{ source: 'census', column: 'median_household_income' }],
    supportsGeoInheritance: false,
  },

  median_age: {
    metricId: 'median_age',
    sources: [{ source: 'census', column: 'median_age' }],
    supportsGeoInheritance: false,
  },

  homeownership_rate: {
    metricId: 'homeownership_rate',
    sources: [{ source: 'census', column: 'homeownership_rate' }],
    supportsGeoInheritance: false,
  },

  population_growth: {
    metricId: 'population_growth',
    sources: [{ source: 'census', column: 'population_yoy' }],
    supportsGeoInheritance: true,
  },

  income_growth: {
    metricId: 'income_growth',
    sources: [{ source: 'census', column: 'income_yoy' }],
    supportsGeoInheritance: false,
  },
};
