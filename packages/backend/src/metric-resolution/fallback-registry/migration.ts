/**
 * Migration metric fallbacks — IRS county-native series, Redfin metro-only
 * series, and the compound `net_migration` that picks the right source per
 * geo level via geographic inheritance.
 *
 * Per-geo source split for `net_migration`:
 *   - Metro request → Redfin net_inflow (monthly/quarterly)
 *   - County request → IRS net_returns (annual)
 *   - ZIP request → no native source; inherits from county (IRS) first,
 *     then metro (Redfin) via the standard parent chain.
 */

import { MetricFallbackChain } from '../metric-resolution.types';

export const migrationMetrics: Record<string, MetricFallbackChain> = {
  // ---- IRS migration aggregates (county only, single source) ----
  irs_migration_in_returns: {
    metricId: 'irs_migration_in_returns',
    sources: [{ source: 'irs', column: 'in_returns' }],
    supportsGeoInheritance: false,
  },

  irs_migration_out_returns: {
    metricId: 'irs_migration_out_returns',
    sources: [{ source: 'irs', column: 'out_returns' }],
    supportsGeoInheritance: false,
  },

  irs_migration_net_returns: {
    metricId: 'irs_migration_net_returns',
    sources: [{ source: 'irs', column: 'net_returns' }],
    supportsGeoInheritance: false,
  },

  irs_migration_in_avg_agi: {
    metricId: 'irs_migration_in_avg_agi',
    sources: [{ source: 'irs', column: 'in_avg_agi' }],
    supportsGeoInheritance: false,
  },

  irs_migration_out_avg_agi: {
    metricId: 'irs_migration_out_avg_agi',
    sources: [{ source: 'irs', column: 'out_avg_agi' }],
    supportsGeoInheritance: false,
  },

  irs_migration_in_exemptions: {
    metricId: 'irs_migration_in_exemptions',
    sources: [{ source: 'irs', column: 'in_exemptions' }],
    supportsGeoInheritance: false,
  },

  irs_migration_out_exemptions: {
    metricId: 'irs_migration_out_exemptions',
    sources: [{ source: 'irs', column: 'out_exemptions' }],
    supportsGeoInheritance: false,
  },

  // ---- Redfin migration metrics (metro level, single source) ----
  redfin_migration_net_inflow: {
    metricId: 'redfin_migration_net_inflow',
    sources: [{ source: 'redfin_migration', column: 'net_inflow' }],
    supportsGeoInheritance: false,
  },

  redfin_migration_inflow_share: {
    metricId: 'redfin_migration_inflow_share',
    sources: [{ source: 'redfin_migration', column: 'inflow_share_pct' }],
    supportsGeoInheritance: false,
  },

  // ---- Compound net_migration: Redfin@metro, IRS@county, inherit at ZIP ----
  net_migration: {
    metricId: 'net_migration',
    sources: [
      {
        source: 'redfin_migration',
        column: 'net_inflow',
        geoLevels: ['metro'],
      },
      { source: 'irs', column: 'net_returns', geoLevels: ['county'] },
    ],
    supportsGeoInheritance: true,
  },
};
