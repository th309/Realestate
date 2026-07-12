/**
 * Market heat / demand / supply score metrics. The headline `market_heat`
 * uses Realtor's `hotness_score` (0-100) as the single source of truth
 * because it covers zip / county / metro, beating Zillow's metro-only
 * market-heat index. Geographic inheritance lets a ZIP miss fall back to
 * its county, then metro, before giving up.
 */

import { MetricFallbackChain } from '../metric-resolution.types';

// anchorNonNull: Realtor's monthly file ships the hotness dataset (hotness /
// demand / supply scores) one period late — the latest-dated rows carry NULL
// in all three columns at every geo level, so latest-row semantics resolve to
// null everywhere and geo inheritance can't help. Anchoring on the most
// recent non-null row serves last month's score instead of an em-dash.
// Display metrics only — never set this on PIQ score inputs.
export const marketHeatMetrics: Record<string, MetricFallbackChain> = {
  market_heat: {
    metricId: 'market_heat',
    sources: [
      { source: 'realtor', column: 'hotness_score', anchorNonNull: true },
    ],
    supportsGeoInheritance: true,
  },

  hotness_score: {
    metricId: 'hotness_score',
    sources: [
      { source: 'realtor', column: 'hotness_score', anchorNonNull: true },
    ],
    supportsGeoInheritance: true,
  },

  demand_score: {
    metricId: 'demand_score',
    sources: [
      { source: 'realtor', column: 'demand_score', anchorNonNull: true },
    ],
    supportsGeoInheritance: true,
  },

  supply_score: {
    metricId: 'supply_score',
    sources: [
      { source: 'realtor', column: 'supply_score', anchorNonNull: true },
    ],
    supportsGeoInheritance: false,
  },
};
