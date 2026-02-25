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
}

export interface GrowthGoal {
  id: string;
  name: string;
  targetPaidUsers: number;
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
  daysRemaining: number;
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

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
