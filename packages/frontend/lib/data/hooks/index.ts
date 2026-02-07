/**
 * HOOKS BARREL EXPORT
 *
 * Re-exports all React Query hooks from a single entry point.
 * Import from '@/lib/data/hooks' or '@/lib/data' for hook access.
 */

// Snapshot data hooks
export {
  useSnapshotData,
  useSnapshotDataBatch,
  type UseSnapshotDataOptions,
  type UseSnapshotDataResult,
} from './useSnapshotData';

// Time series data hooks
export {
  useTimeSeriesData,
  useAvailableDates,
  type UseTimeSeriesDataOptions,
  type UseTimeSeriesDataResult,
} from './useTimeSeriesData';

// Trend data hooks
export {
  useTrendData,
  useTrendDataBatch,
  useMarketFactorsTrends,
  type UseTrendDataOptions,
  type UseTrendDataResult,
} from './useTrendData';

// Data card hooks (composite)
export {
  useDataCard,
  useDataCardBatch,
  type UseDataCardOptions,
  type UseDataCardResult,
} from './useDataCard';

// Score data hooks
export {
  useScoreData,
  useSingleScore,
  type UseScoreDataOptions,
  type UseScoreDataResult,
} from './useScoreData';

// Metric access (entitlements gating)
export {
  useMetricAccess,
  type MetricAccessResult,
} from './useMetricAccess';
