/**
 * FETCHERS BARREL EXPORT
 *
 * Re-exports all data fetching functions from a single entry point.
 *
 * Internally organized into domain-grouped sub-barrels under `_groups/`
 * to comply with file-size limits (CLAUDE.md §1.3). Consumers continue to
 * import from `@/lib/data` (or `./fetchers`) — this split is invisible.
 */

export * from "./_groups/core";
export * from "./_groups/markets";
export * from "./_groups/scoring";
export * from "./_groups/reports";
export * from "./_groups/billing";
export * from "./_groups/onboarding";
export * from "./_groups/organizations";
export * from "./_groups/admin";

// Deal Analyzer (market context, AI verdict, saved analyses)
export * from "./analyzer";

// Analyzer prefill bundle (address-driven field prefill with provenance)
export {
  fetchAnalyzerPrefill,
  type AnalyzerPrefillBundle,
  type AnalyzerPrefillParams,
  type PrefillField,
  type PrefillFieldKey,
  type PrefillConfidenceGrade,
} from "./analyzer-prefill";

// Market screener
export {
  fetchScreener,
  fetchScreenerMovers,
  type ScreenerGeoLevel,
  type MoverWindow,
  type ScreenerQuery,
  type ScreenerRow,
  type ScreenerResult,
  type ScreenerMoversQuery,
  type ScreenerMoversResult,
} from "./screener";

// Score heatmap (Market Momentum Map widget)
export * from "./score-heatmap";

// Web push subscriptions
export {
  subscribeToPush,
  unsubscribeFromPush,
  type PushSubscribeRequest,
  type PushSubscriptionKeysDto,
} from "./push-subscriptions";

// Market Explorer (scope series timelines)
export * from "./market-explorer";

// Social connect (one-click account connection via the Late aggregator)
export * from "./social-connect";
