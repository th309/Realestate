/**
 * UNIFIED DATA LAYER TYPES (barrel)
 *
 * Central type definitions for the data layer, organized by domain under `./types/`.
 * This file re-exports every type so existing `./types` and `@/lib/data` imports keep working.
 */

export type { GeoLevel } from "./types/geography";
export type {
  MetricFormat,
  DataSource,
  MetricConfig,
} from "./types/metric-config";
export type {
  SnapshotEntry,
  SnapshotData,
  SnapshotFetchOptions,
} from "./types/snapshot";
export type {
  TimeSeriesPoint,
  TimeSeriesResult,
  TimeSeriesHistoryResult,
  TimeSeriesFetchOptions,
  DateRangeResponse,
} from "./types/timeseries";
export type { TrendDirection, TrendResult } from "./types/trend";
export type {
  ScoreType,
  ConfidenceLevel,
  ComponentStatus,
  ScoreComponentBreakdown,
  SingleScoreResult,
  ScoreResponse,
  BatchScoreResponse,
} from "./types/score";
export type { ApiResponse, ApiResponseItem } from "./types/api";
export type {
  MetricDataEntry,
  MetricData,
  HomeValueEntry,
  HomeValues,
  MapDataEntry,
  MapData,
  TimeSeriesDataPoint,
  TimeSeriesResponse,
} from "./types/legacy";
