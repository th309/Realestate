/**
 * TIME SERIES DATA TYPES
 */

/**
 * A single point in a time series
 */
export interface TimeSeriesPoint {
  date: string;
  value: number;
}

/**
 * Result from fetching time series data
 */
export interface TimeSeriesResult {
  success: boolean;
  metric: string;
  geoLevel: string;
  regionId: string;
  count: number;
  data: TimeSeriesPoint[];
  /** Present when historyMonths was requested */
  historyMonths?: number;
  current?: number | null;
  prior?: number | null;
  trend_change?: number;
  history?: TimeSeriesHistoryResult;
}

/**
 * History result with trend calculation
 */
export interface TimeSeriesHistoryResult {
  data: TimeSeriesPoint[];
  months: number;
  trend: "up" | "down" | "stable";
  change: number;
}

/**
 * Options for fetching time series data
 */
export interface TimeSeriesFetchOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
  historyMonths?: number;
}

/**
 * Date range response for a metric/geography combination
 */
export interface DateRangeResponse {
  success: boolean;
  metric: string;
  geoLevel: string;
  minDate: string;
  maxDate: string;
  count: number;
}
