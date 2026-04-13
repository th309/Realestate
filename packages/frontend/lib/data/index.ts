/**
 * UNIFIED DATA LAYER
 *
 * Central entry point for all data layer functionality.
 * Import from '@/lib/data' to access types, registry, helpers, and fetchers.
 */

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
// AUTH
// ============================================================================
export { getAuthHeaders } from "./fetchers/auth-headers";

// ============================================================================
// FETCHERS
// ============================================================================
export {
  // Base
  API_URL,
  fetchAPI,
  fetchAPIWithParams,
  fetchAPIRaw,

  // Snapshot
  fetchSnapshotData,
  fetchMetricData,
  toHomeValues,

  // Time series
  fetchTimeSeriesData,
  fetchAvailableDates,
  timeSeriesApi,

  // Trend
  fetchTrendData,
  fetchTrendDataBatch,
  normalizeSparklineData,

  // Scores
  fetchScore,
  fetchBatchScores,
  fetchScoreExpanded,
  fetchTopMarkets,
  type TopMarketsGeo,
  type TopMarketsScoreType,
  type TopMarketEntry,

  // Markets
  fetchMarketStats,
  type MarketStats,

  // Market AI analysis
  fetchMarketAnalysis,
  type MarketAnalysisSection,
  type MarketAnalysisResult,

  // Market snapshot (batch)
  fetchMarketSnapshot,
  type MarketSnapshotMetric,
  type MarketSnapshotScoreEntry,
  type MarketSnapshotResponse,
  fetchBatchTrendsServer,
  type BatchTrendEntry,

  // Reports
  fetchReport,
  fetchSampleReport,
  fetchSharedReport,
  createReportShareLink,
  fetchReportHistory,
  fetchReportList,
  generateReport,
  regenerateNarratives,
  sendReportMessage,
  fetchReportConversation,
  type GenerateReportRequest,
  type GenerateReportResponse,

  // Report follow-up (alerts + market changes)
  fetchReportFollowUp,
  dismissReportAlert,
  type FollowUpAlert,
  type MarketChange,
  type ReportFollowUpData,

  // Benchmarks
  fetchBenchmarks,
  fetchMetricBenchmarks,
  type BenchmarkData,
  type BenchmarkResult,

  // GeoJSON
  getGeoJsonApiUrl,

  // Market search lists & geography search
  fetchGeographySearch,
  fetchZipDisplayNames,
  type GeographySearchResult,
  fetchMetrosList,
  fetchCountiesList,
  fetchZipsList,
  fetchCitiesList,
  fetchMarketsMetros,
  fetchMarketsCounties,
  fetchMarketsZips,
  fetchMarketsCities,

  // Scoring validation & report templates
  fetchQuintilePerformance,
  fetchReportTemplates,
  fetchValidationSummary,
  fetchValidationQuintiles,
  fetchValidationScatter,
  fetchValidationTimeSeries,
  fetchValidationGeography,
  type ValidationGeography,
  type ValidationScoreType,
  type ValidationSummary,
  type ValidationQuintile,
  type ValidationScatterPoint,
  type ValidationTimeSeriesPoint,
  type ValidationGeographyBreakdown,

  // Pricing
  fetchPricingSummary,
  type PricingTier,
  type TrialInfo,
  type PricingSummary,

  // Alerts
  fetchAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  fetchAlertHistory,
  markAlertRead,
  type Alert,
  type AlertHistoryEntry,

  // Billing
  startCheckout,
  getBillingPortalUrl,
  fetchSubscriptionStatus,
  cancelSubscription,
  resumeSubscription,
  type SubscriptionStatus,
  type CancelSubscriptionResult,

  // Recommendations
  fetchMarketsToWatch,
  type MarketRecommendation,

  // Email preferences
  fetchEmailPreferences,
  updateEmailPreferences,
  type EmailPreferences,

  // Support
  submitSupportTicket,
  submitContactForm,
  type SupportTicket,
  type ContactFormData,

  // Onboarding
  fetchOnboardingState,
  completeOnboarding,
  resetOnboarding,
  saveOnboardingPreferences,
  startOnboardingTrial,
  saveOnboardingMarketSelection,
  updateChecklistTask,
  incrementUsageStat,
  dismissBeaconTask,
  type OnboardingState,

  // Insights
  fetchInsight,
  type InsightData,

  // User quiz preferences
  fetchPreferences,
  upsertPreferences,
  type UserPreferences,
  type UpsertPreferencesPayload,
  type UserGoal,
  type Timeline,

  // Market match (personalized scores)
  fetchTopMarketMatches,
  fetchMarketMatch,
  type MatchScoreResult,
  type MetricBreakdownEntry,

  // Watchlist
  fetchWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
  type AddToWatchlistDto,

  // Research brief
  fetchClarifyingQuestions,
  generateResearchBrief,
  type ClarifyingQuestion,
  type ClarifyingQuestionOption,
  type ClarifyingQuestionsResponse,
  type ResearchBriefResponse,
} from "./fetchers";

// AI model configuration (admin)
export {
  fetchAiModelConfigs,
  updateAiModelConfig,
  fetchProviderPresets,
  type AiModelConfig,
} from "./fetchers";

// Organization management
export {
  fetchMyOrg,
  fetchOrg,
  fetchOrgMembers,
  fetchOrgAuditLog,
  fetchInviteDetails,
  createOrganization,
  updateOrganization,
  inviteOrgMember,
  changeOrgMemberRole,
  removeOrgMember,
  acceptOrgInvite,
  transferOrgOwnership,
  type OrgData,
  type OrgMember,
  type OrgMembersResponse,
  type AuditLogEntry,
  type AuditLogResponse,
  type InviteDetails,
} from "./fetchers";

// Organization report stats
export {
  fetchOrgReportStats,
  type OrgReportStats,
  type OrgReportMemberStats,
} from "./fetchers";

// Organization billing
export {
  fetchOrgBilling,
  createOrgCheckout,
  createOrgBillingPortal,
  updateOrgSeats,
  type OrgBillingUsage,
  type OrgCheckoutResult,
  type OrgBillingPortalResult,
} from "./fetchers";

// Organization branding
export {
  fetchOrgBranding,
  updateOrgBranding,
  uploadOrgLogo,
  deleteOrgLogo,
  fetchPublicBranding,
  setCustomDomain,
  verifyCustomDomain,
  removeCustomDomain,
  type OrgBranding,
} from "./fetchers";

// Organization embed tokens
export {
  fetchOrgEmbedTokens,
  createOrgEmbedToken,
  updateOrgEmbedToken,
  revokeOrgEmbedToken,
  fetchEmbedBranding,
  fetchEmbedScore,
  fetchEmbedMetricCard,
  fetchEmbedMapData,
  type EmbedConfig,
  type EmbedToken,
  type EmbedTokenListItem,
  type EmbedBranding,
  type EmbedScoreData,
  type EmbedMetricCardData,
  type EmbedMapRegion,
  type EmbedMapData,
} from "./fetchers";

// Organization API keys
export {
  fetchOrgApiKeys,
  createOrgApiKey,
  updateOrgApiKey,
  revokeOrgApiKey,
  type ApiKey,
  type ApiKeyListItem,
  type CreateApiKeyPayload,
  type UpdateApiKeyPayload,
} from "./fetchers";

// Personal API keys
export {
  fetchUserApiKeys,
  createUserApiKey,
  revokeUserApiKey,
  type UserApiKey,
  type UserApiKeyListItem,
  type CreateUserApiKeyPayload,
} from "./fetchers";

// Enterprise grace period
export {
  fetchGraceStatus,
  setupEnterpriseBilling,
  type GraceStatus,
} from "./fetchers";

// Shares
export {
  createMarketShare,
  sendMarketShareEmail,
  type CreateMarketShareData,
  type MarketShareResult,
} from "./fetchers";

// Social proof (engagement stats for geography)
export {
  fetchSocialProof,
  type SocialProofStats,
} from "./fetchers/social-proof";

// Admin analytics (separate export block — avoids collision with TimeSeriesPoint in types.ts)
export * from "./fetchers/admin-analytics";
export type * from "./fetchers/admin-analytics.types";

// ============================================================================
// VALIDATION CLAIMS (PropertyIQ v4 validation stats)
// ============================================================================
export {
  V4_CLAIMS,
  getV4HomepageClaims,
  formatDollarClaim,
  formatDollarClaimShort,
  formatObservations,
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
