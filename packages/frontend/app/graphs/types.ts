// Re-export types from central metric config
export type { GeoLevel, MetricConfig, MetricFormat, DataSource } from '@/app/map/config/metrics';

// Graph-specific types
export interface ComparisonConfig {
  enabled: boolean;
  area: string;
}

export interface Milestone {
  year: number;
  label: string;
}

export interface MetricOption {
  id: string;
  name: string;
  category: string;
}

export interface MetricCategory {
  id: string;
  name: string;
  metrics: MetricOption[];
}
