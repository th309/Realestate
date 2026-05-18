/**
 * Price-related metric fallbacks: home values, listings, appreciation,
 * forecasts, and price-per-square-foot.
 */

import { MetricFallbackChain } from '../metric-resolution.types';
import { toPercent } from './transforms';

export const priceMetrics: Record<string, MetricFallbackChain> = {
  home_value: {
    metricId: 'home_value',
    sources: [
      { source: 'zillow', column: 'zhvi' },
      { source: 'redfin', column: 'median_sale_price' },
      { source: 'realtor', column: 'median_listing_price' },
      { source: 'census', column: 'median_home_value' },
    ],
    supportsGeoInheritance: false,
  },

  listing_price: {
    metricId: 'listing_price',
    sources: [
      { source: 'realtor', column: 'median_listing_price' },
      { source: 'redfin', column: 'median_list_price' },
    ],
    supportsGeoInheritance: false,
  },

  home_value_yoy: {
    metricId: 'home_value_yoy',
    sources: [
      {
        source: 'realtor',
        column: 'median_listing_price_yy',
        transform: toPercent,
      },
    ],
    supportsGeoInheritance: false,
  },

  home_value_mom: {
    metricId: 'home_value_mom',
    sources: [
      {
        source: 'realtor',
        column: 'median_listing_price_mm',
        transform: toPercent,
      },
    ],
    supportsGeoInheritance: false,
  },

  home_price_forecast: {
    metricId: 'home_price_forecast',
    sources: [{ source: 'zillow', column: 'zhvf_12m' }],
    supportsGeoInheritance: false,
  },

  home_value_5yr: {
    metricId: 'home_value_5yr',
    sources: [{ source: 'calculated', column: 'home_value_5yr_cagr' }],
    supportsGeoInheritance: false,
  },

  price_per_sqft: {
    metricId: 'price_per_sqft',
    sources: [
      { source: 'realtor', column: 'median_listing_price_per_square_foot' },
      { source: 'redfin', column: 'median_ppsf' },
    ],
    supportsGeoInheritance: false,
  },
};
