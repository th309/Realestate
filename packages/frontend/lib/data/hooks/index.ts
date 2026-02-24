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
  type ScoreGatingInfo,
} from './useScoreData';

// Market snapshot (batch - replaces useDataCardBatch for Markets page)
export {
  useMarketSnapshot,
  type MarketSnapshotCard,
  type UseMarketSnapshotOptions,
  type UseMarketSnapshotResult,
} from './useMarketSnapshot';

// Metric access (entitlements gating)
export {
  useMetricAccess,
  type MetricAccessResult,
} from './useMetricAccess';

// Data freshness / "as of" dates
export {
  useDataFreshness,
  useMetricFreshness,
  type UseDataFreshnessResult,
  type UseMetricFreshnessResult,
} from './useDataFreshness';

// Top markets (rankings)
export {
  useTopMarkets,
  type UseTopMarketsOptions,
  type UseTopMarketsResult,
} from './useTopMarkets';

// Pricing tiers
export {
  usePricingTiers,
  buildPriceLookup,
  type UsePricingTiersResult,
  type TierPriceLookup,
} from './usePricingTiers';

// Validation data hooks
export {
  useValidationSummary,
  useValidationQuintiles,
  useValidationScatter,
  useValidationTimeSeries,
  useValidationGeography,
  type UseValidationSummaryOptions,
  type UseValidationQuintilesOptions,
  type UseValidationScatterOptions,
  type UseValidationTimeSeriesOptions,
  type UseValidationGeographyOptions,
} from './useValidationData';
