/**
 * New-construction metrics — Zillow `new_con_*` series. Single source each.
 */

import { MetricFallbackChain } from '../metric-resolution.types';

export const newConstructionMetrics: Record<string, MetricFallbackChain> = {
  new_construction_sales: {
    metricId: 'new_construction_sales',
    sources: [{ source: 'zillow', column: 'new_con_sales' }],
    supportsGeoInheritance: false,
  },

  new_construction_price: {
    metricId: 'new_construction_price',
    sources: [{ source: 'zillow', column: 'new_con_median_price' }],
    supportsGeoInheritance: false,
  },

  new_construction_ppsf: {
    metricId: 'new_construction_ppsf',
    sources: [{ source: 'zillow', column: 'new_con_median_price_per_sqft' }],
    supportsGeoInheritance: false,
  },
};
