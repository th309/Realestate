/**
 * ADMIN ANALYTICS TYPES
 *
 * Frontend equivalents of the backend analytics response shapes.
 * Used by admin-analytics.ts fetchers and the analytics dashboard components.
 */

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

export interface AnalyticsTimeSeriesPoint {
  date: string;
  value: number;
}

export interface FunnelStep {
  name: string;
  count: number;
  rateFromPrevious: number;
  rateFromFirst: number;
}

export interface Annotation {
  id: string;
  annotationDate: string;
  label: string;
  description?: string;
}

export const TRAFFIC_SEGMENTS = [
  "human",
  "bot",
  "unclassified",
  "internal",
  "all",
] as const;

export type TrafficSegment = (typeof TRAFFIC_SEGMENTS)[number];

export interface AnalyticsFilters {
  tier?: string;
  device?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  /**
   * Which population every number on the page describes. Defaults to `human`
   * server-side. NOT the complement of `bot`: ~46,000 of 48,600 sessions in the
   * trailing 30 days are unclassified — written before classification existed
   * and unknowable after the fact — so they are their own bucket. `internal` is
   * our own admin/owner browsing, subtracted from human, bot AND unclassified.
   */
  traffic?: TrafficSegment;
}

/**
 * Session counts per classification for the current window.
 *
 * The four buckets are disjoint and sum to `total`, so a number that moves
 * between them is visibly moving rather than appearing from nowhere.
 */
export interface TrafficSegmentCounts {
  human: number;
  bot: number;
  unclassified: number;
  /** Our own browsing. Excluded from the other three, not additional to them. */
  internal: number;
  total: number;
}

export interface PageMetric {
  pagePath: string;
  pageGroup?: string;
  views: number;
  /** Distinct visitors who saw the page. */
  visitors: number;
  /**
   * Optional — not derivable from a pageview rollup. These were previously
   * hardcoded to 0 server-side, which rendered as a real "0%" on every row.
   * Undefined means "not measured"; render a dash, never a zero.
   */
  bounceRate?: number;
  avgTimeSeconds?: number;
  conversionRate?: number;
}

export interface GrowthMilestone {
  target: number;
  label: string;
  reached: boolean;
  reachedAt?: string;
  projectedDate?: string;
}

export interface GrowthProgress {
  goal: {
    id: string;
    name: string;
    targetPaidUsers: number;
    startDate: string;
    targetDate: string;
    milestones: { target: number; label: string }[];
    isActive: boolean;
  };
  currentPaidUsers: number;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  currentGrowthRate: number;
  requiredGrowthRate: number;
  milestoneProgress: GrowthMilestone[];
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
  activeUsersChart: AnalyticsTimeSeriesPoint[];
  /** Counts per classification for the same window, whatever segment is shown. */
  trafficSegments?: TrafficSegmentCounts;
  goalProgress: GrowthProgress[];
  annotations: Annotation[];
}

export interface NavigationFlow {
  fromPage: string;
  toPage: string;
  transitions: number;
  /**
   * Distinct visitors who made this transition — a second dimension, not a
   * restatement of `transitions`. One visitor looping a page 26 times is 26
   * transitions and 1 visitor.
   */
  visitors?: number;
}

export interface PathSequence {
  path: string[];
  sessions: number;
  conversionRate?: number;
}

export interface LandingPageMetric {
  page: string;
  sessions: number;
  bounceRate: number;
  avgDuration: number;
}

export interface ExitPageMetric {
  page: string;
  exits: number;
}

export interface DurationBucket {
  bucket: string;
  count: number;
}

/**
 * An off-site destination reached by clicking a link on our site.
 *
 * Captured at click time. A browser gives the departing page no access to
 * where a navigation lands, so exits by typed URL, bookmark or tab close are
 * unobservable and never appear here.
 */
export interface OutboundDestination {
  domain: string;
  clicks: number;
  sessions: number;
  topUrl: string;
  fromPage: string;
}

export interface JourneyData {
  landingPages: LandingPageMetric[];
  exitPages: ExitPageMetric[];
  navigationFlows: NavigationFlow[];
  commonPaths: PathSequence[];
  outboundDestinations: OutboundDestination[];
  avgPagesPerSession: number;
  sessionDurationDistribution: DurationBucket[];
  annotations: Annotation[];
}

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
  dauWauMau: { dau: number; wau: number; mau: number; stickiness: number };
  retentionCurves: { tier: string; curve: number[] }[];
  churnSignals: ChurnRiskUser[];
  engagementTrend: AnalyticsTimeSeriesPoint[];
  annotations: Annotation[];
}

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
  channelTrend: { channel: string; data: AnalyticsTimeSeriesPoint[] }[];
  annotations: Annotation[];
}

export interface PaywallMetric {
  /** Resolved from event properties (feature/trigger/geoLevel), not event_label. */
  gate: string;
  surface: string;
  views: number;
  viewers: number;
  ctaClicks: number;
  /** null when there were no gate views — 0/0, not a 0% click-through. */
  ctr: number | null;
}

export interface FeatureConvMetric {
  feature: string;
  users: number;
  converted: number;
  conversionRate: number;
  baselineRate: number;
  /** Multiple of baseline; null when there is no baseline to divide by. */
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
    mrr: number;
    /** null when nobody is billed — 0/0 is undefined, not zero. */
    arpu: number | null;
    tierDistribution: TierCount[];
    compedCount?: number;
    /** Billed but payment failing — a subset of MRR, not additional to it. */
    dunningCount?: number;
  };
  tierMigration: TierFlow[];
  annotations: Annotation[];
}

// Visitors tab — see ./admin-analytics-visitors.types.ts
export * from "./admin-analytics-visitors.types";
