/**
 * Inventory and listing-activity metrics: for-sale counts, year-over-year
 * deltas, days on market, new + pending listings, and price-cut/increase
 * shares.
 */

import { MetricFallbackChain } from '../metric-resolution.types';
import { toPercent } from './transforms';

export const inventoryMetrics: Record<string, MetricFallbackChain> = {
  for_sale_inventory: {
    metricId: 'for_sale_inventory',
    sources: [
      { source: 'realtor', column: 'active_listing_count' },
      { source: 'redfin', column: 'inventory' },
    ],
    supportsGeoInheritance: false,
  },

  inventory_yoy: {
    metricId: 'inventory_yoy',
    sources: [
      {
        source: 'realtor',
        column: 'active_listing_count_yy',
        transform: toPercent,
      },
    ],
    supportsGeoInheritance: false,
  },

  days_on_market: {
    metricId: 'days_on_market',
    sources: [
      { source: 'realtor', column: 'median_days_on_market' },
      { source: 'redfin', column: 'median_dom' },
    ],
    supportsGeoInheritance: false,
  },

  new_listings: {
    metricId: 'new_listings',
    sources: [
      { source: 'realtor', column: 'new_listing_count' },
      { source: 'redfin', column: 'new_listings' },
    ],
    supportsGeoInheritance: false,
  },

  new_listings_yoy: {
    metricId: 'new_listings_yoy',
    sources: [
      {
        source: 'realtor',
        column: 'new_listing_count_yy',
        transform: toPercent,
      },
    ],
    supportsGeoInheritance: false,
  },

  pending_listings: {
    metricId: 'pending_listings',
    sources: [
      { source: 'realtor', column: 'pending_listing_count' },
      { source: 'redfin', column: 'pending_sales' },
    ],
    supportsGeoInheritance: false,
  },

  pending_ratio: {
    metricId: 'pending_ratio',
    sources: [{ source: 'realtor', column: 'pending_ratio' }],
    supportsGeoInheritance: false,
  },

  price_cut_pct: {
    metricId: 'price_cut_pct',
    sources: [
      {
        source: 'realtor',
        column: 'price_reduced_share',
        transform: toPercent,
      },
      { source: 'redfin', column: 'price_drops' },
    ],
    supportsGeoInheritance: false,
  },

  price_increase_pct: {
    metricId: 'price_increase_pct',
    sources: [
      {
        source: 'realtor',
        column: 'price_increased_share',
        transform: toPercent,
      },
    ],
    supportsGeoInheritance: false,
  },
};
