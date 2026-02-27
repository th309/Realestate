/**
 * ADMIN ANALYTICS TYPES
 *
 * Frontend equivalents of the backend analytics response shapes.
 * Used by admin-analytics.ts fetchers and the analytics dashboard components.
 */

export interface MetricWithTrend {
  current: number;
  previous: number;
  changePercent: number;
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

export interface AnalyticsFilters {
  tier?: string;
  device?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
}

export interface PageMetric {
  pagePath: string;
  pageGroup?: string;
  views: number;
  bounceRate: number;
  avgTimeSeconds: number;
  conversionRate: number;
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
  sparklines: Record<string, number[]>;
  quickFunnel: FunnelStep[];
  topPages: PageMetric[];
  activeUsersChart: AnalyticsTimeSeriesPoint[];
  goalProgress: GrowthProgress[];
  annotations: Annotation[];
}

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
  revenueMetrics: { mrr: number; arpu: number; tierDistribution: TierCount[] };
  tierMigration: TierFlow[];
  annotations: Annotation[];
}
