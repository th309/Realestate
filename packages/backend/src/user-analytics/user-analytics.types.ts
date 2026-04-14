/**
 * Type definitions for the SaaS analytics suite.
 * Covers all 5 dashboard tabs + event ingestion shapes.
 */

// ============================================================
// Shared primitives
// ============================================================

export interface MetricWithTrend {
  current: number;
  previous: number;
  changePercent: number;
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
  bounceRate: number;
  avgTimeSeconds: number;
  conversionRate: number;
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
  sparklines: Record<string, number[]>;
  quickFunnel: FunnelStep[];
  topPages: PageMetric[];
  activeUsersChart: TimeSeriesPoint[];
  goalProgress: GoalProgress[];
  annotations: Annotation[];
}

// ============================================================
// Journeys tab
// ============================================================

export interface NavigationFlow {
  fromPage: string;
  toPage: string;
  transitions: number;
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

export interface JourneyData {
  landingPages: LandingPageMetric[];
  exitPages: ExitPageMetric[];
  navigationFlows: NavigationFlow[];
  commonPaths: PathSequence[];
  avgPagesPerSession: number;
  sessionDurationDistribution: DurationBucket[];
  annotations: Annotation[];
}

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
  tier: string;
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

export interface PaywallMetric {
  resource: string;
  views: number;
  clicks: number;
  ctr: number;
  conversions: number;
}

export interface FeatureConvMetric {
  feature: string;
  converterRate: number;
  nonConverterRate: number;
  users: number;
  signalStrength: number;
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
    arpu: number;
    tierDistribution: TierCount[];
  };
  tierMigration: TierFlow[];
  annotations: Annotation[];
}
