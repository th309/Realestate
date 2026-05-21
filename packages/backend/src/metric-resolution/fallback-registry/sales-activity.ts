/**
 * Sales / activity metrics: counts of homes sold, year-over-year deltas,
 * and the sale-to-list ratio.
 */

import { MetricFallbackChain } from '../metric-resolution.types';
import { toPercent } from './transforms';

export const salesActivityMetrics: Record<string, MetricFallbackChain> = {
  home_sales: {
    metricId: 'home_sales',
    sources: [
      { source: 'zillow', column: 'sales_count' },
      { source: 'redfin', column: 'homes_sold' },
      { source: 'realtor', column: 'pending_listing_count' },
    ],
    supportsGeoInheritance: false,
  },

  home_sales_yoy: {
    metricId: 'home_sales_yoy',
    sources: [
      {
        source: 'realtor',
        column: 'pending_listing_count_yy',
        transform: toPercent,
      },
    ],
    supportsGeoInheritance: false,
  },

  sale_to_list: {
    metricId: 'sale_to_list',
    sources: [
      { source: 'zillow', column: 'sale_to_list', transform: toPercent },
      { source: 'redfin', column: 'avg_sale_to_list' },
    ],
    supportsGeoInheritance: false,
  },
};
