/**
 * Calculated investment-metric fallbacks. These are derived figures (not
 * raw source data) — cap rate, gross yield, rent-to-price ratio, GRM,
 * overvalued percent, inventory surplus, income-to-buy, and affordable home
 * price. All resolved through the `calculated` source which reads a derived
 * value from a pre-computed view.
 */

import { MetricFallbackChain } from '../metric-resolution.types';
import { toPercent } from './transforms';

export const calculatedMetrics: Record<string, MetricFallbackChain> = {
  cap_rate: {
    metricId: 'cap_rate',
    sources: [{ source: 'calculated', column: 'cap_rate' }],
    supportsGeoInheritance: false,
  },

  gross_yield: {
    metricId: 'gross_yield',
    sources: [{ source: 'calculated', column: 'gross_yield' }],
    supportsGeoInheritance: false,
  },

  rent_to_price_ratio: {
    metricId: 'rent_to_price_ratio',
    sources: [
      {
        source: 'calculated',
        column: 'rent_to_price_ratio',
        transform: toPercent,
      },
    ],
    supportsGeoInheritance: false,
  },

  grm: {
    metricId: 'grm',
    sources: [{ source: 'calculated', column: 'grm' }],
    supportsGeoInheritance: false,
  },

  overvalued_pct: {
    metricId: 'overvalued_pct',
    sources: [{ source: 'calculated', column: 'overvalued_pct' }],
    supportsGeoInheritance: false,
  },

  inventory_surplus: {
    metricId: 'inventory_surplus',
    sources: [{ source: 'calculated', column: 'inventory_surplus_pct' }],
    supportsGeoInheritance: false,
  },

  income_to_buy: {
    metricId: 'income_to_buy',
    sources: [{ source: 'calculated', column: 'income_to_buy' }],
    supportsGeoInheritance: false,
  },

  affordable_home_price: {
    metricId: 'affordable_home_price',
    sources: [{ source: 'calculated', column: 'affordable_home_price' }],
    supportsGeoInheritance: false,
  },
};
