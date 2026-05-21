/**
 * Briefing-generator alias metrics. These map the names the briefing /
 * stance-engine pipelines use onto existing source rules, so the briefing
 * code can request a single canonical name without knowing the underlying
 * source columns. They duplicate some chains from price.ts and inventory.ts
 * intentionally — keeping them named under "briefing aliases" preserves the
 * existing semantics and makes the dependency direction explicit.
 */

import { MetricFallbackChain } from '../metric-resolution.types';
import { toPercent } from './transforms';

export const briefingAliasMetrics: Record<string, MetricFallbackChain> = {
  /** Alias for home_value_yoy — used by briefing generator & stance engine */
  appreciation_yoy: {
    metricId: 'appreciation_yoy',
    sources: [
      {
        source: 'realtor',
        column: 'median_listing_price_yy',
        transform: toPercent,
      },
      { source: 'redfin', column: 'median_sale_price_yoy' },
    ],
    supportsGeoInheritance: false,
  },

  /** Alias for days_on_market — used by briefing generator */
  dom: {
    metricId: 'dom',
    sources: [
      { source: 'realtor', column: 'median_days_on_market' },
      { source: 'redfin', column: 'median_dom' },
    ],
    supportsGeoInheritance: false,
  },

  /** Alias for for_sale_inventory — used by briefing generator */
  inventory: {
    metricId: 'inventory',
    sources: [
      { source: 'realtor', column: 'active_listing_count' },
      { source: 'redfin', column: 'inventory' },
    ],
    supportsGeoInheritance: false,
  },

  /** Alias for rent growth — used by briefing generator */
  rent_growth_yoy: {
    metricId: 'rent_growth_yoy',
    sources: [{ source: 'calculated', column: 'zori_yoy' }],
    supportsGeoInheritance: false,
  },

  /** Alias for price_to_rent — used by briefing generator */
  price_to_rent: {
    metricId: 'price_to_rent',
    sources: [{ source: 'calculated', column: 'price_rent_ratio' }],
    supportsGeoInheritance: false,
  },

  /** Alias for price_to_income — used by briefing generator */
  price_to_income: {
    metricId: 'price_to_income',
    sources: [{ source: 'calculated', column: 'price_to_income' }],
    supportsGeoInheritance: false,
  },

  /** Alias for permits_growth — used by briefing generator */
  permits_growth: {
    metricId: 'permits_growth',
    sources: [
      { source: 'permits', column: 'total_units_yoy', geoLevels: ['county'] },
    ],
    supportsGeoInheritance: true,
  },
};
