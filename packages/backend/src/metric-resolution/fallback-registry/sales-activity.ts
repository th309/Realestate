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
      // Redfin Data Center (fresh, monthly). average_sale_to_list_ratio is
      // ALREADY percent form (e.g. 98.23), so no transform. Restricted to
      // county/zip: those rows are one-per-region, but the metro table stores
      // split-CBSA metros as two division rows sharing one region_id, and the
      // generic single-row fetch would pick one division instead of the CBSA
      // figure. Metro sale_to_list therefore stays on the CBSA-correct
      // zillow -> legacy-redfin chain below.
      {
        source: 'redfin_dc',
        column: 'average_sale_to_list_ratio',
        geoLevels: ['county', 'zip'],
      },
      // Zillow sale_to_list is a fraction (0.98) — ×100 for display percent.
      { source: 'zillow', column: 'sale_to_list', transform: toPercent },
      // Legacy redfin_* tables (FROZEN). avg_sale_to_list is a fraction like
      // Zillow's, so ×100. Last-resort fallback — still covers e.g. Charleston
      // metro, whose row is mis-keyed (region_id 16620) in the new DC table.
      { source: 'redfin', column: 'avg_sale_to_list', transform: toPercent },
    ],
    supportsGeoInheritance: false,
  },
};
