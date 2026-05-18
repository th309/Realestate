/**
 * Economic indicator fallbacks — BLS / BEA-derived employment, GDP,
 * unemployment, and cost-of-living signals. All support geographic
 * inheritance (small-area economic data is often metro-only, so a ZIP
 * request walks up to county then metro).
 */

import { MetricFallbackChain } from '../metric-resolution.types';

export const economicMetrics: Record<string, MetricFallbackChain> = {
  unemployment_rate: {
    metricId: 'unemployment_rate',
    sources: [{ source: 'economic', column: 'unemployment_rate' }],
    supportsGeoInheritance: true,
  },

  job_growth: {
    metricId: 'job_growth',
    sources: [{ source: 'economic', column: 'employment_yoy' }],
    supportsGeoInheritance: true,
  },

  gdp_growth: {
    metricId: 'gdp_growth',
    sources: [{ source: 'economic', column: 'gdp_yoy' }],
    supportsGeoInheritance: true,
  },

  cost_of_living: {
    metricId: 'cost_of_living',
    sources: [{ source: 'economic', column: 'rpp_all_items' }],
    supportsGeoInheritance: true,
  },
};
