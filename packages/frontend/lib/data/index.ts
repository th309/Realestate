/**
 * UNIFIED DATA LAYER
 *
 * Central entry point for all data layer functionality.
 * Import from '@/lib/data' to access types, registry, helpers, and fetchers.
 *
 * Internally split into domain-grouped sub-barrels (CLAUDE.md §1.3 file-size
 * compliance). Consumer imports are unchanged.
 */

// Analyzer-specific exports (grading, upgrade-path, AI insights, property
// lookup) extracted into `_analyzer-data-exports.ts` per CLAUDE.md §1.3.
export * from "./_analyzer-data-exports";

// ============================================================================
// TYPES
// ============================================================================
export type {
  // Geography
  GeoLevel,

  // Metric configuration
  MetricFormat,
  DataSource,
  MetricConfig,

  // Snapshot data
  SnapshotEntry,
  SnapshotData,
  SnapshotFetchOptions,

  // Time series data
  TimeSeriesPoint,
  TimeSeriesResult,
  TimeSeriesHistoryResult,
  TimeSeriesFetchOptions,
  DateRangeResponse,

  // Trend data
  TrendDirection,
  TrendResult,

  // Score data
  ScoreType,
  ConfidenceLevel,
  ComponentStatus,
  ScoreComponentBreakdown,
  SingleScoreResult,
  ScoreResponse,
  BatchScoreResponse,

  // API types
  ApiResponse,
  ApiResponseItem,

  // Legacy aliases
  MetricDataEntry,
  MetricData,
  HomeValueEntry,
  HomeValues,
  MapDataEntry,
  MapData,
  TimeSeriesDataPoint,
  TimeSeriesResponse,
} from "./types";

// ============================================================================
// REGISTRY
// ============================================================================
export {
  // Constants
  METRICS,
  DATA_DATES,
  DATA_SOURCE_ANCHORS,
  METRO_ONLY_METRICS,
  GEO_ZOOM_LEVELS,
  GEOJSON_SOURCES,

  // Functions
  metricHasTimeSeries,
  isScoreMetric,
} from "./registry";

// ============================================================================
// REGISTRY HELPERS
// ============================================================================
export {
  getMetricConfig,
  getKeyFieldForGeo,
  getGeoPathSegment,
  isMetricSupportedForGeo,
  getMetricFormat,
  getMetricTitle,
  getMetricDataDate,
  formatDataDateForDisplay,
  getDefaultZoom,
  getAllMetricIds,
  getMetricsByDataSource,
  getMetricsForGeoLevel,
  getMetricDefinition,
  getDataSourceAnchor,
  METRIC_DEFINITIONS,
  getMetricFavorableDirection,
} from "./registry-helpers";

export type { MetricDefinition } from "./registry-helpers";

// ============================================================================
// FORMATTING
// ============================================================================
export {
  formatMetricValue,
  formatPercentChange,
  getTrendDirection,
} from "./format";

// ============================================================================
// FETCHERS
// ============================================================================
// All fetcher functions/types live in `./fetchers/_groups/*` and are
// re-exported through `./fetchers/index.ts`.
export * from "./fetchers";

// Score distribution (momentum-band histogram, powers the /forecast hub)
export {
  fetchScoreDistribution,
  type ScoreDistributionData,
  type ScoreDistributionBucket,
} from "./fetchers/score-distribution";

// NOTE: `API_URL` is already part of this public API via the export chain
// (./fetchers → _groups/core → base → api-url). Browser code MUST import it
// from "@/lib/data" — it resolves to the same-origin `/backend` proxy so ad
// blockers don't reject the request — instead of building a URL from
// `process.env.NEXT_PUBLIC_API_URL`.

// ============================================================================
// VALIDATION CLAIMS (PropertyIQ v4 validation stats)
// ============================================================================
export {
  V4_CLAIMS,
  getV4HomepageClaims,
  formatDollarClaim,
  formatDollarClaimShort,
  formatObservations,
  formatMarketsScored,
} from "./validation-claims";

// ============================================================================
// HOOKS
// ============================================================================
export {
  // Snapshot
  useSnapshotData,
  useSnapshotDataBatch,
  type UseSnapshotDataOptions,
  type UseSnapshotDataResult,

  // Time series
  useTimeSeriesData,
  useAvailableDates,
  type UseTimeSeriesDataOptions,
  type UseTimeSeriesDataResult,

  // Trend
  useTrendData,
  useTrendDataBatch,
  useMarketFactorsTrends,
  type UseTrendDataOptions,
  type UseTrendDataResult,

  // Data card
  useDataCard,
  useDataCardBatch,
  type UseDataCardOptions,
  type UseDataCardResult,

  // Scores
  useScoreData,
  useSingleScore,
  type UseScoreDataOptions,
  type UseScoreDataResult,

  // Market snapshot (batch - replaces useDataCardBatch for Markets page)
  useMarketSnapshot,
  type MarketSnapshotCard,
  type UseMarketSnapshotOptions,
  type UseMarketSnapshotResult,

  // Top markets (rankings)
  useTopMarkets,
  type UseTopMarketsOptions,
  type UseTopMarketsResult,

  // Metric access (entitlements gating)
  useMetricAccess,
  type MetricAccessResult,

  // Pricing tiers
  usePricingTiers,
  buildPriceLookup,
  type UsePricingTiersResult,
  type TierPriceLookup,

  // Insights
  useInsight,

  // User quiz preferences
  usePreferences,
  type UsePreferencesResult,

  // Market match (personalized scores)
  useTopMarketMatches,
  useMarketMatch,
  type UseTopMarketMatchesOptions,
  type UseTopMarketMatchesResult,
  type UseMarketMatchOptions,
  type UseMarketMatchResult,

  // Watchlist
  useWatchlist,

  // Organization
  useMyOrg,

  // Validation data hooks
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

  // Anonymous listing presentation (activation tour)
  useAnonymousListingPresentation,
  type UseAnonymousListingPresentationVariables,

  // Authenticated listing presentation (tour aha-finale, signed-in path)
  useAuthenticatedListingPresentation,
  type UseAuthenticatedListingPresentationVariables,

  // Tour signup mutation (anonymous → claimed user conversion)
  useTourSignup,

  // Analyzer customization (thresholds + assumption defaults)
  useThresholds,
  useUpdateThresholds,
  useDeleteThresholds,
  useAnalyzerDefaults,
  useUpdateAnalyzerDefaults,

  // Analyzer prefill hook
  useAnalyzerPrefill,

  // Market screener hook
  useScreener,
  type UseScreenerOptions,
  type UseScreenerResult,

  // Screener movers hook
  useScreenerMovers,
  type UseScreenerMoversOptions,
  type UseScreenerMoversResult,

  // Admin AI model configuration hooks
  useAiModelConfigs,
  useProviderPresets,
  useUpdateAiModelConfig,

  // Score heatmap (Market Momentum Map widget)
  useScoreHeatmap,
  type UseScoreHeatmapResult,
} from "./hooks";

// ============================================================================
// METRO SLUGS
// ============================================================================
export {
  METRO_SLUG_DATA,
  SLUG_TO_METRO,
  CBSA_TO_METRO,
} from "./metro-slug-data";
export {
  generateMetroSlug,
  getMetroShortName,
  getMetroState,
} from "./metro-slugs";
export type { MetroSlugEntry } from "./metro-slugs";
export {
  formatGeoDisplayName,
  titleCaseLocationName,
} from "./geo-display-name";
