// Re-export types from central metric config
export type { GeoLevel, MetricConfig, MetricFormat, DataSource } from '@/app/map/config/metrics';

// Graph-specific types
export interface ComparisonConfig {
  enabled: boolean;
  /** Display name (e.g. "Austin-Round Rock-Georgetown, TX") */
  area: string;
  /** API regionId when from search (metro/county/city/zip); omit for state/national dropdown */
  areaId?: string;
}

export interface Milestone {
  year: number;
  label: string;
}

export interface MetricOption {
  id: string;
  name: string;
  category: string;
  isPremium?: boolean;
}

export interface MetricCategory {
  id: string;
  name: string;
  metrics: MetricOption[];
}
