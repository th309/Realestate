/**
 * Types for the AI Marketing Insights Engine.
 *
 * The AI analyzes platform data across 7 sources and generates
 * prioritized, actionable growth recommendations streamed via SSE.
 */

export type AiProvider = 'deepseek' | 'claude';

export interface AiInsightsQueryDto {
  /** Time range in days (7, 30, 90) */
  days?: number;
  /** LLM provider selection */
  provider?: AiProvider;
  /** Follow-up question for chat mode */
  prompt?: string;
  /** Conversation history for multi-turn chat (JSON string) */
  history?: string;
  /** Optional focus area to activate a specialist persona */
  focusArea?: string;
}

export interface GrowthGoal {
  id: string;
  name: string;
  targetPaidUsers: number;
  startDate: string;
  targetDate: string;
  milestones: GrowthMilestone[];
  isActive: boolean;
}

export interface GrowthMilestone {
  target: number;
  label: string;
  reachedAt?: string;
}

export interface GrowthProgress {
  goal: GrowthGoal;
  currentPaidUsers: number;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  currentGrowthRate: number;
  requiredGrowthRate: number;
  milestoneProgress: MilestoneStatus[];
}

export interface MilestoneStatus {
  target: number;
  label: string;
  reached: boolean;
  reachedAt?: string;
  projectedDate?: string;
}

export interface InsightsDataSnapshot {
  /** From PaywallAnalyticsService.getStats() */
  paywallStats: Record<string, unknown>;
  /** From PaywallAnalyticsService.getFunnelData() */
  funnelData: Record<string, unknown>;
  /** Stripe/billing aggregates */
  revenueData: RevenueSnapshot;
  /** Trial statistics */
  trialData: TrialSnapshot;
  /** Feature usage from analytics_events */
  featureUsage: FeatureUsageSnapshot;
  /** Tier-feature matrix */
  tierMatrix: Record<string, unknown>;
  /** User aggregate counts */
  userAggregates: UserAggregates;
  /** Growth goal progress */
  growthProgress: GrowthProgress;
  /** Overview KPIs and traffic data from UserAnalyticsModule */
  overview: Record<string, unknown> | null;
  /** User navigation path data from JourneyAnalyticsService */
  journeys: Record<string, unknown> | null;
  /** Cohort retention and churn signals from RetentionAnalyticsService */
  retention: Record<string, unknown> | null;
  /** Traffic source and channel data from AcquisitionAnalyticsService */
  acquisition: Record<string, unknown> | null;
  /** Funnel and upgrade path data from ConversionAnalyticsService */
  conversion: Record<string, unknown> | null;
  /** Published blog post metadata from frontend */
  blogPosts: BlogPostMetadata[];
}

export interface RevenueSnapshot {
  totalPaidUsers: number;
  usersByTier: Record<string, number>;
  activeSubscriptions: number;
  failedPayments: number;
  recentChurns: number;
  estimatedMrr: number;
}

export interface TrialSnapshot {
  activeTrials: number;
  expiredTrials: number;
  convertedTrials: number;
  cancelledTrials: number;
  conversionRate: number;
  avgTrialDurationDays: number;
}

export interface FeatureUsageSnapshot {
  topEventsByCount: Array<{
    eventName: string;
    count: number;
    uniqueUsers: number;
  }>;
  eventsByTier: Record<string, number>;
  recentTrend: Array<{
    date: string;
    count: number;
  }>;
}

export interface UserAggregates {
  totalUsers: number;
  usersByTier: Record<string, number>;
  recentSignups30d: number;
  activeUsers30d: number;
  paidUsers: number;
}

export interface BlogPostMetadata {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  targetKeyword: string;
  tags: string[];
  readingTime: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
