/**
 * Market heat / demand / supply score metrics. The headline `market_heat`
 * uses Realtor's `hotness_score` (0-100) as the single source of truth
 * because it covers zip / county / metro, beating Zillow's metro-only
 * market-heat index. Geographic inheritance lets a ZIP miss fall back to
 * its county, then metro, before giving up.
 */

import { MetricFallbackChain } from '../metric-resolution.types';

export const marketHeatMetrics: Record<string, MetricFallbackChain> = {
  market_heat: {
    metricId: 'market_heat',
    sources: [{ source: 'realtor', column: 'hotness_score' }],
    supportsGeoInheritance: true,
  },

  hotness_score: {
    metricId: 'hotness_score',
    sources: [{ source: 'realtor', column: 'hotness_score' }],
    supportsGeoInheritance: true,
  },

  demand_score: {
    metricId: 'demand_score',
    sources: [{ source: 'realtor', column: 'demand_score' }],
    supportsGeoInheritance: true,
  },

  supply_score: {
    metricId: 'supply_score',
    sources: [{ source: 'realtor', column: 'supply_score' }],
    supportsGeoInheritance: false,
  },
};
