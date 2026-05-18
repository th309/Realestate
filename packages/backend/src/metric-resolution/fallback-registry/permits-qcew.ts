/**
 * Permits and QCEW-only metrics consolidated into one file because each is
 * small (4 + 2 entries) and they're conceptually related as labor-and-supply
 * indicators that share county-level granularity.
 *
 * Permits come from the Census Bureau Building Permits Survey (county-only
 * native, with `permits_yoy` and `permits_growth` supporting inheritance up
 * to metro).
 *
 * QCEW (Quarterly Census of Employment and Wages) wage and establishment
 * counts support inheritance so small-area requests roll up.
 */

import { MetricFallbackChain } from '../metric-resolution.types';

export const permitsAndQcewMetrics: Record<string, MetricFallbackChain> = {
  // ---- Permits (county-native) ----
  sf_permits: {
    metricId: 'sf_permits',
    sources: [{ source: 'permits', column: 'sf_units', geoLevels: ['county'] }],
    supportsGeoInheritance: false,
  },

  mf_permits: {
    metricId: 'mf_permits',
    sources: [
      { source: 'permits', column: 'large_multi_units', geoLevels: ['county'] },
    ],
    supportsGeoInheritance: false,
  },

  total_permits: {
    metricId: 'total_permits',
    sources: [
      { source: 'permits', column: 'total_units', geoLevels: ['county'] },
    ],
    supportsGeoInheritance: false,
  },

  permits_yoy: {
    metricId: 'permits_yoy',
    sources: [
      { source: 'permits', column: 'total_units_yoy', geoLevels: ['county'] },
    ],
    supportsGeoInheritance: true,
  },

  // ---- QCEW wage + establishment metrics ----
  qcew_avg_weekly_wage: {
    metricId: 'qcew_avg_weekly_wage',
    sources: [{ source: 'qcew', column: 'qcew_avg_weekly_wage' }],
    supportsGeoInheritance: true,
  },

  qcew_total_establishments: {
    metricId: 'qcew_total_establishments',
    sources: [{ source: 'qcew', column: 'qcew_total_establishments' }],
    supportsGeoInheritance: true,
  },
};
