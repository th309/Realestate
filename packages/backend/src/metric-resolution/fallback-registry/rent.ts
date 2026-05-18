/**
 * Rent-related metric fallbacks: the headline rent index and SFR-specific
 * rent (Zillow ZORDI).
 */

import { MetricFallbackChain } from '../metric-resolution.types';

export const rentMetrics: Record<string, MetricFallbackChain> = {
  rent_index: {
    metricId: 'rent_index',
    sources: [
      { source: 'zillow', column: 'zori' },
      { source: 'hud_fmr', column: 'fmr_2br', geoLevels: ['zip'] },
      { source: 'census', column: 'median_gross_rent' },
    ],
    supportsGeoInheritance: false,
  },

  rent_for_houses: {
    metricId: 'rent_for_houses',
    sources: [{ source: 'zillow', column: 'zordi_sfr' }],
    supportsGeoInheritance: false,
  },
};
