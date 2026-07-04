/**
 * Migration metric fallbacks — IRS county-native series, Redfin metro-only
 * series, and the compound `net_migration` that picks the right source per
 * geo level via geographic inheritance.
 *
 * Per-geo source split for `net_migration`:
 *   - Metro request → Redfin net_inflow if present, else the `irs_metro_rollup`
 *     computed source (sum of the metro's county IRS net_returns). Redfin's
 *     metro migration dataset is not publicly available, so in practice the
 *     rollup is what resolves — and it is unit-consistent with the county source
 *     below (same net_returns column), unlike Redfin's user-flow net_inflow.
 *   - County request → IRS net_returns (annual)
 *   - ZIP request → no native source; inherits from county (IRS) first,
 *     then metro (rollup) via the standard parent chain.
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

  // ---- Compound net_migration: metro (Redfin→IRS rollup), IRS@county, inherit at ZIP ----
  net_migration: {
    metricId: 'net_migration',
    sources: [
      // Kept first for forward-compatibility: if the Redfin migration table is
      // ever populated it wins at metro. It is empty today (dataset is not
      // public), so resolution falls through to the rollup below.
      {
        source: 'redfin_migration',
        column: 'net_inflow',
        geoLevels: ['metro'],
      },
      // Metro fallback: sum the metro's county-level IRS net_returns. This is
      // what actually resolves net_migration at metro level.
      {
        source: 'irs_metro_rollup',
        column: 'net_returns',
        geoLevels: ['metro'],
      },
      { source: 'irs', column: 'net_returns', geoLevels: ['county'] },
    ],
    supportsGeoInheritance: true,
  },
};
