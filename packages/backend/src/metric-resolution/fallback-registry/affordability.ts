/**
 * Affordability metrics. Zillow's affordability series is metro-only;
 * `years_to_save` falls back to a calculated value when the metro source
 * is missing.
 */

import { MetricFallbackChain } from '../metric-resolution.types';

export const affordabilityMetrics: Record<string, MetricFallbackChain> = {
  years_to_save: {
    metricId: 'years_to_save',
    sources: [
      { source: 'zillow', column: 'years_to_save', geoLevels: ['metro'] },
      { source: 'calculated', column: 'years_to_save' },
    ],
    supportsGeoInheritance: false,
  },

  income_to_rent: {
    metricId: 'income_to_rent',
    sources: [
      { source: 'zillow', column: 'renter_income', geoLevels: ['metro'] },
    ],
    supportsGeoInheritance: false,
  },
};
