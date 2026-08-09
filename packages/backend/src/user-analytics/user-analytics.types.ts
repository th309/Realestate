/**
 * Type definitions for the SaaS analytics suite.
 * Covers all 5 dashboard tabs + event ingestion shapes.
 */

import type { TrafficSegment } from './traffic-segment';

// ============================================================
// Shared primitives
// ============================================================

export interface MetricWithTrend {
  current: number;
  previous: number;
  /**
   * null when the two windows are not comparable — specifically when the
   * comparison period predates the instrumentation that classifies a session as
   * human, which makes the delta a measure of coverage rather than of change.
   */
  changePercent: number | null;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface FunnelStep {
  name: string;
  count: number;
  rateFromPrevious: number;
  rateFromFirst: number;
}

/** Single-event step — the existing shape, preserved for the 2 pre-existing funnel rows. */
export type FunnelStepSingle = {
  event_category: string;
  event_action: string;
  label?: string;
};

/** Multi-event step — visitor qualifies if they fired ANY of the listed events. */
export type FunnelStepMulti = {
  any_of: Array<{ event_category: string; event_action: string }>;
  label?: string;
};

export type FunnelStepDef = FunnelStepSingle | FunnelStepMulti;

/** Type guard for multi-event step. */
export function isMultiStep(step: FunnelStepDef): step is FunnelStepMulti {
  return 'any_of' in step;
}

export interface Annotation {
  id: string;
  annotationDate: string;
  label: string;
  description?: string;
}

export interface AnalyticsFilters {
  tier?: string;
  device?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  /**
   * Which population every number describes. Defaults to `human`.
   * See traffic-segment.ts — `human` is NOT the complement of `bot`, because
   * ~46,000 of 48,600 trailing-30-day sessions are unclassified.
   */
  traffic?: TrafficSegment;
}

/**
 * Session counts per classification, so the UI can state what it excluded.
 * Disjoint buckets summing to `total`: `internal` is subtracted from the other
 * three, not added alongside them.
 */
export interface TrafficSegmentCounts {
  human: number;
  bot: number;
  unclassified: number;
  internal: number;
  total: number;
}

// ============================================================
// Event ingestion
// ============================================================

export interface IngestableEvent {
  client_event_id?: string;
  visitor_id: string;
  session_id: string;
  user_id?: string;
  user_tier?: string;
  event_category: string;
  event_action: string;
  event_label?: string;
  numeric_value?: number;
  page_path?: string;
  previous_page_path?: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

export interface IngestionResult {
  accepted: number;
  rejected: number;
}

// ============================================================
// Overview tab
// ============================================================

export interface PageMetric {
  pagePath: string;
  pageGroup?: string;
  views: number;
  /** Distinct visitors who saw the page — the honest second dimension. */
  visitors: number;
  /**
   * Computed by analytics_page_performance by joining pageviews back to their
   * session (bounce/exit/landing page, session duration, signup attribution).
   * Still optional: bounceRate is undefined when no session ENTERED on this
   * page (nothing to compute a bounce rate over), and conversionRate is
   * undefined when visitors is 0. Undefined means "not measured" — the UI
   * shows a dash rather than a fabricated zero, which is what a prior,
   * simpler pageview-only rollup used to hardcode here.
   */
  bounceRate?: number;
  avgTimeSeconds?: number;
  conversionRate?: number;
}

export interface GoalProgress {
  id: string;
  name: string;
  targetValue: number;
  currentValue: number;
  progressPercent: number;
}

export interface OverviewData {
  kpis: {
    uniqueVisitors: MetricWithTrend;
    totalSessions: MetricWithTrend;
    avgSessionDuration: MetricWithTrend;
    bounceRate: MetricWithTrend;
    pagesPerSession: MetricWithTrend;
    conversionRate: MetricWithTrend;
  };
  /** False when trend deltas span the instrumentation boundary — hide arrows. */
  trendsComparable?: boolean;
  sparklines: Record<string, number[]>;
  quickFunnel: FunnelStep[];
  topPages: PageMetric[];
  activeUsersChart: TimeSeriesPoint[];
  /**
   * Session counts per classification for the SAME window, regardless of which
   * segment is being displayed. Lets the UI say what it excluded — a filtered
   * number and a broken one look identical unless the exclusion is stated.
   */
  trafficSegments?: TrafficSegmentCounts;
  goalProgress: GoalProgress[];
  annotations: Annotation[];
}

// ============================================================
// Journeys tab — see ./journey.types.ts
// ============================================================

export * from './journey.types';

// ============================================================
// Retention tab
// ============================================================

export interface CohortRow {
  cohort: string;
  cohortSize: number;
  weeks: number[];
}

export interface ChurnRiskUser {
  userId: string;
  email?: string;
  lastSeen: string;
  sessionCount: number;
  tier: string | null;
  topFeatures: string[];
}

export interface RetentionData {
  cohortMatrix: CohortRow[];
  dauWauMau: {
    dau: number;
    wau: number;
    mau: number;
    stickiness: number;
  };
  retentionCurves: { tier: string; curve: number[] }[];
  churnSignals: ChurnRiskUser[];
  engagementTrend: TimeSeriesPoint[];
  annotations: Annotation[];
}

// ============================================================
// Acquisition tab
// ============================================================

export interface SourceMetric {
  source: string;
  entryType: string;
  sessions: number;
  percentage: number;
}

export interface LandingPerf {
  page: string;
  sessions: number;
  bounceRate: number;
  avgTime: number;
  signups: number;
  conversionRate: number;
}

export interface AttributionRow {
  source: string;
  visitors: number;
  signups: number;
  trials: number;
  paid: number;
  conversionRate: number;
  arpu?: number;
}

export interface AcquisitionData {
  trafficSources: SourceMetric[];
  landingPagePerformance: LandingPerf[];
  sourceToConversion: AttributionRow[];
  channelTrend: { channel: string; data: TimeSeriesPoint[] }[];
  annotations: Annotation[];
}

// ============================================================
// Conversion tab
// ============================================================

/**
 * One upgrade gate's effectiveness.
 *
 * `gate` is resolved from the event's `properties` (feature / trigger /
 * geoLevel) falling back to page_path — NOT from `event_label`, which is NULL on
 * every one of these events and made the whole panel read "unknown".
 *
 * There is no `conversions` field. No event links an upgrade back to the gate
 * that prompted it, so the old column was initialised to 0 and never
 * incremented — rendering "this gate converted nobody" forever, which is a
 * claim, not a gap.
 */
export interface PaywallMetric {
  gate: string;
  surface: string;
  views: number;
  viewers: number;
  ctaClicks: number;
  /** null when there were no gate views — 0/0, not a 0% click-through. */
  ctr: number | null;
}

/**
 * "Of the people who used this feature, how many signed up?"
 *
 * Replaces a shape that compared share-of-converters against
 * share-of-non-converters and reported a signed `signalStrength` — unreadable,
 * and returning [] on every load because the query selected a column that does
 * not exist.
 *
 * `users` is part of the contract, not decoration: the highest rate in live data
 * comes from a single visitor (1 user, 1 signup, 100%). Ranking on rate alone
 * puts noise on top, so the UI must show and weight by sample size.
 */
export interface FeatureConvMetric {
  feature: string;
  users: number;
  converted: number;
  conversionRate: number;
  /** Site-wide signup rate for the same window, for comparison. */
  baselineRate: number;
  /** Multiple of baseline. null when there is no baseline to divide by. */
  lift: number | null;
}

export interface TierFlow {
  fromTier: string;
  toTier: string;
  count: number;
}

export interface TierCount {
  tier: string;
  count: number;
  revenue: number;
}

export interface ConversionData {
  fullFunnel: FunnelStep[];
  customFunnels: { name: string; steps: FunnelStep[] }[];
  paywallEffectiveness: PaywallMetric[];
  featureCorrelation: FeatureConvMetric[];
  revenueMetrics: {
    /** Billed subscriptions only — Stripe subscription present. */
    mrr: number;
    /**
     * null when nobody is billed. 0/0 is undefined, and "$0 average revenue per
     * user" asserts a measurement; the UI renders a dash instead.
     */
    arpu: number | null;
    tierDistribution: TierCount[];
    /**
     * Active paid tiers with NO Stripe subscription — comped and admin-granted
     * accounts. Counted separately because `subscription_status = 'active'` is
     * set by manual tier grants and is not a billing fact, so including them
     * reported list-price revenue nobody had paid.
     */
    compedCount: number;
    /**
     * Billed subscribers whose payment is FAILING (past_due / unpaid with a live
     * Stripe subscription). A subset of the population behind `mrr` — they are
     * counted because the subscription is live — surfaced separately so
     * uncollected revenue does not read identically to collected revenue.
     */
    dunningCount: number;
  };
  tierMigration: TierFlow[];
  annotations: Annotation[];
}

// ============================================================
// Visitors tab — see ./visitor-journey.types.ts
// ============================================================

export * from './visitor-journey.types';
