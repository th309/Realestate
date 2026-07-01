export interface GeographyChain {
  geographyId: string;
  geographyType: string;
  countyFips: string | null;
  metroCbsa: string | null;
  stateFips: string | null;
  parentCountyFips: string | null;
  parentMetroCbsa: string | null;
  parentStateFips: string | null;
}

export interface MetricWithSource {
  value: number | null;
  sourceGeographyId: string | null;
  sourceGeographyType: string | null;
  isInherited: boolean;
}

export interface MetricsBundle {
  metrics: Record<string, MetricWithSource>;
  inheritedCount: number;
  directCount: number;
  missingCount: number;
  completeness: number;
}

// Metrics that commonly need inheritance (not available at ZIP/City level)
export const INHERITABLE_METRICS = [
  'unemployment_rate',
  'employment_yoy',
  'gdp_yoy',
  'total_permits_yoy',
  'large_multi_permits_yoy',
  'sf_permits_yoy',
  'rpp_all_items',
  'rpp_housing',
] as const;
