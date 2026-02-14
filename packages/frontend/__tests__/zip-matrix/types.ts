/**
 * ZIP Matrix Test Types
 */

export type ResultStatus = 'pass' | 'empty' | 'fail' | 'n/a';

export interface MetricResult {
  status: ResultStatus;
  value?: number | string | null;
  error?: string;
  responseTime?: number;
}

export interface ZipResults {
  [metricId: string]: ResultStatus;
}

export interface MetricSummary {
  pass: number;
  empty: number;
  fail: number;
  'n/a': number;
}

export interface StateResults {
  state: string;
  runDate: string;
  totalZips: number;
  duration: number;
  summary: { [metricId: string]: MetricSummary };
  zips: { [zipCode: string]: ZipResults };
}

export interface AggregateReport {
  runDate: string;
  totalStates: number;
  totalZips: number;
  totalChecks: number;
  duration: number;
  metrics: {
    [metricId: string]: {
      pass: number;
      empty: number;
      fail: number;
      'n/a': number;
      passRate: number;
    };
  };
  statesSummary: {
    [state: string]: {
      zips: number;
      passRate: number;
    };
  };
}

export interface MetricConfig {
  id: string;
  name: string;
  endpoint: string;
  endpointType: 'state-list' | 'individual' | 'bulk';
  params?: Record<string, string>;
  valueField?: string;
  zipLevel: boolean; // false = metro-only, mark as n/a
}
