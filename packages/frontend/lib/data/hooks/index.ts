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
} from "./useSnapshotData";

// Time series data hooks
export {
  useTimeSeriesData,
  useAvailableDates,
  type UseTimeSeriesDataOptions,
  type UseTimeSeriesDataResult,
} from "./useTimeSeriesData";

// Trend data hooks
export {
  useTrendData,
  useTrendDataBatch,
  useMarketFactorsTrends,
  type UseTrendDataOptions,
  type UseTrendDataResult,
} from "./useTrendData";

// Data card hooks (composite)
export {
  useDataCard,
  useDataCardBatch,
  type UseDataCardOptions,
  type UseDataCardResult,
} from "./useDataCard";

// Score data hooks
export {
  useScoreData,
  useSingleScore,
  type UseScoreDataOptions,
  type UseScoreDataResult,
  type ScoreGatingInfo,
} from "./useScoreData";

// Market snapshot (batch - replaces useDataCardBatch for Markets page)
export {
  useMarketSnapshot,
  type MarketSnapshotCard,
  type UseMarketSnapshotOptions,
  type UseMarketSnapshotResult,
} from "./useMarketSnapshot";

// Metric access (entitlements gating)
export { useMetricAccess, type MetricAccessResult } from "./useMetricAccess";

// Data freshness / "as of" dates
export {
  useDataFreshness,
  useMetricFreshness,
  type UseDataFreshnessResult,
  type UseMetricFreshnessResult,
} from "./useDataFreshness";

// Top markets (rankings)
export {
  useTopMarkets,
  type UseTopMarketsOptions,
  type UseTopMarketsResult,
} from "./useTopMarkets";

// Pricing tiers
export {
  usePricingTiers,
  buildPriceLookup,
  type UsePricingTiersResult,
  type TierPriceLookup,
} from "./usePricingTiers";

// Insights (AI-generated market narratives)
export { useInsight } from "./useInsight";

// User quiz preferences
export { usePreferences, type UsePreferencesResult } from "./usePreferences";

// Market match (personalized scores)
export {
  useTopMarketMatches,
  useMarketMatch,
  type UseTopMarketMatchesOptions,
  type UseTopMarketMatchesResult,
  type UseMarketMatchOptions,
  type UseMarketMatchResult,
} from "./useMarketMatch";

// Watchlist
export { useWatchlist } from "./useWatchlist";

// Organization
export { useMyOrg } from "./useMyOrg";

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
} from "./useValidationData";

// Anonymous listing presentation (activation tour)
export {
  useAnonymousListingPresentation,
  type UseAnonymousListingPresentationVariables,
} from "./useAnonymousListingPresentation";

// Tour signup (anonymous → claimed user conversion)
export { useTourSignup } from "./useTourSignup";

// Analyzer customization — per-strategy thresholds + assumption defaults
export {
  useThresholds,
  useUpdateThresholds,
  useDeleteThresholds,
} from "./useThresholds";
export {
  useAnalyzerDefaults,
  useUpdateAnalyzerDefaults,
} from "./useAnalyzerDefaults";

// Address geocoding (Mapbox street-address autocomplete for the Deal Analyzer)
export { useAddressGeocode } from "./useAddressGeocode";

// Analyzer prefill bundle (address-driven field prefill with provenance)
export { useAnalyzerPrefill } from "./useAnalyzerPrefill";
