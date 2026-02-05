// Re-export types from unified data layer
export type { GeoLevel, MetricConfig, MetricFormat, DataSource } from '@/lib/data';

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
