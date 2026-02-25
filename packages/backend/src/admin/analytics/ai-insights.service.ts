/**
 * AI Insights Data Assembly Service
 *
 * Gathers platform data from 7 sources (paywall stats, funnel data,
 * revenue, trials, feature usage, tier matrix, user aggregates),
 * calculates growth goal progress, builds the system prompt with
 * persona + data context, and delegates to AiProviderService for
 * streaming LLM responses.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';
import { PaywallAnalyticsService } from './paywall-analytics.service';
import { AiProviderService } from './ai-provider.service';
import {
  AiProvider,
  ChatMessage,
  GrowthProgress,
  InsightsDataSnapshot,
  MilestoneStatus,
  RevenueSnapshot,
  TrialSnapshot,
  FeatureUsageSnapshot,
  UserAggregates,
} from './ai-insights.types';
import { buildProductContext } from './site-context';

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly paywallAnalytics: PaywallAnalyticsService,
    private readonly aiProvider: AiProviderService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Stream initial analysis or follow-up response.
   * Gathers all platform data, constructs the prompt, and streams from the LLM.
   */
  async *streamInsights(options: {
    days: number;
    provider: AiProvider;
    prompt?: string;
    history?: ChatMessage[];
  }): AsyncGenerator<string> {
    const { days, provider, prompt, history } = options;

    // Gather all data in parallel
    const snapshot = await this.gatherDataSnapshot(days);

    // Build system prompt with persona + data
    const systemPrompt = this.buildSystemPrompt(snapshot, days);

    // Build messages array
    const messages: ChatMessage[] = [];

    if (history && history.length > 0) {
      // Multi-turn: include conversation history
      messages.push(...history);
      if (prompt) {
        messages.push({ role: 'user', content: prompt });
      }
    } else if (prompt) {
      // Follow-up with no history
      messages.push({ role: 'user', content: prompt });
    } else {
      // Initial analysis request
      messages.push({
        role: 'user',
        content:
          'Analyze the platform data provided and generate your full marketing insights report across all 11 categories. Prioritize the most impactful findings. Skip categories where you have no meaningful insight — don\'t pad with generic advice.',
      });
    }

    yield* this.aiProvider.streamCompletion(systemPrompt, messages, provider);
  }

  /**
   * Get growth goal progress (data-driven, no LLM).
   */
  async getGrowthProgress(): Promise<GrowthProgress> {
    const client = this.supabase.getClient();

    // Get active goal
    const { data: goal } = await client
      .from('growth_goals')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!goal) {
      return this.emptyGrowthProgress();
    }

    // Count current paid users
    const { count: paidUsers } = await client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .in('subscription_tier', ['pro', 'enterprise'])
      .eq('subscription_status', 'active');

    const currentPaidUsers = paidUsers || 0;
    const targetDate = new Date(goal.target_date);
    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    // Calculate growth rates
    const thirtyDaysAgo = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000,
    );
    const { count: newPaidLast30d } = await client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .in('subscription_tier', ['pro', 'enterprise'])
      .eq('subscription_status', 'active')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const currentGrowthRate = (newPaidLast30d || 0) / 30;
    const usersNeeded = goal.target_paid_users - currentPaidUsers;
    const requiredGrowthRate =
      daysRemaining > 0 ? usersNeeded / daysRemaining : 0;

    // Calculate milestone progress
    const milestones: MilestoneStatus[] = (goal.milestones || []).map(
      (m: { target: number; label: string }) => {
        const reached = currentPaidUsers >= m.target;
        let projectedDate: string | undefined;
        if (!reached && currentGrowthRate > 0) {
          const daysToReach =
            (m.target - currentPaidUsers) / currentGrowthRate;
          const projected = new Date(
            now.getTime() + daysToReach * 24 * 60 * 60 * 1000,
          );
          projectedDate = projected.toISOString();
        }
        return {
          target: m.target,
          label: m.label,
          reached,
          projectedDate,
        };
      },
    );

    return {
      goal: {
        id: goal.id,
        name: goal.name,
        targetPaidUsers: goal.target_paid_users,
        targetDate: goal.target_date,
        milestones: goal.milestones,
        isActive: goal.is_active,
      },
      currentPaidUsers,
      daysRemaining,
      currentGrowthRate: Math.round(currentGrowthRate * 100) / 100,
      requiredGrowthRate: Math.round(requiredGrowthRate * 100) / 100,
      milestoneProgress: milestones,
    };
  }

  // --- Private: Data gathering ---

  private async gatherDataSnapshot(
    days: number,
  ): Promise<InsightsDataSnapshot> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const startIso = startDate.toISOString();
    const endIso = now.toISOString();

    const [
      paywallStats,
      funnelData,
      revenueData,
      trialData,
      featureUsage,
      tierMatrix,
      userAggregates,
      growthProgress,
    ] = await Promise.all([
      this.paywallAnalytics
        .getStats({ startDate: startIso, endDate: endIso })
        .then((stats) => stats as unknown as Record<string, unknown>),
      this.paywallAnalytics.getFunnelData({
        startDate: startIso,
        endDate: endIso,
      }),
      this.getRevenueSnapshot(startIso),
      this.getTrialSnapshot(startIso),
      this.getFeatureUsageSnapshot(startIso),
      this.getTierMatrix(),
      this.getUserAggregates(startIso),
      this.getGrowthProgress(),
    ]);

    return {
      paywallStats,
      funnelData,
      revenueData,
      trialData,
      featureUsage,
      tierMatrix,
      userAggregates,
      growthProgress,
    };
  }

  private async getRevenueSnapshot(since: string): Promise<RevenueSnapshot> {
    const client = this.supabase.getClient();

    const [paidResult, tierResult, failedResult, churnResult, tierPriceResult] =
      await Promise.all([
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .in('subscription_tier', ['pro', 'enterprise'])
          .eq('subscription_status', 'active'),
        client
          .from('user_profiles')
          .select('subscription_tier')
          .in('subscription_tier', ['pro', 'enterprise'])
          .eq('subscription_status', 'active'),
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('subscription_status', 'past_due'),
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('subscription_status', 'cancelled')
          .gte('updated_at', since),
        client
          .from('subscription_tiers')
          .select('slug, price_monthly')
          .in('slug', ['pro', 'enterprise']),
      ]);

    const tierCounts: Record<string, number> = {};
    (tierResult.data || []).forEach(
      (u: { subscription_tier: string }) => {
        const tier = u.subscription_tier || 'unknown';
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      },
    );

    // Estimate MRR from live tier pricing in subscription_tiers table
    const tierPrices: Record<string, number> = {};
    (tierPriceResult.data || []).forEach(
      (t: { slug: string; price_monthly: string | number | null }) => {
        tierPrices[t.slug] = Number(t.price_monthly) || 0;
      },
    );
    const estimatedMrr =
      (tierCounts['pro'] || 0) * (tierPrices['pro'] || 0) +
      (tierCounts['enterprise'] || 0) * (tierPrices['enterprise'] || 0);

    return {
      totalPaidUsers: paidResult.count || 0,
      usersByTier: tierCounts,
      activeSubscriptions: paidResult.count || 0,
      failedPayments: failedResult.count || 0,
      recentChurns: churnResult.count || 0,
      estimatedMrr,
    };
  }

  private async getTrialSnapshot(since: string): Promise<TrialSnapshot> {
    const client = this.supabase.getClient();
    const now = new Date().toISOString();

    const [activeResult, expiredResult, convertedResult, cancelledResult, trialDurations] =
      await Promise.all([
        client
          .from('user_trials')
          .select('*', { count: 'exact', head: true })
          .is('converted_at', null)
          .is('cancelled_at', null)
          .gt('expires_at', now),
        client
          .from('user_trials')
          .select('*', { count: 'exact', head: true })
          .is('converted_at', null)
          .is('cancelled_at', null)
          .lte('expires_at', now),
        client
          .from('user_trials')
          .select('*', { count: 'exact', head: true })
          .not('converted_at', 'is', null),
        client
          .from('user_trials')
          .select('*', { count: 'exact', head: true })
          .not('cancelled_at', 'is', null),
        client
          .from('user_trials')
          .select('started_at, expires_at'),
      ]);

    const active = activeResult.count || 0;
    const expired = expiredResult.count || 0;
    const converted = convertedResult.count || 0;
    const cancelled = cancelledResult.count || 0;
    const totalCompleted = expired + converted + cancelled;
    const conversionRate =
      totalCompleted > 0 ? (converted / totalCompleted) * 100 : 0;

    // Calculate average trial duration from actual data
    let avgTrialDurationDays = 14; // default fallback
    const trials = trialDurations.data || [];
    if (trials.length > 0) {
      const totalDays = trials.reduce(
        (sum: number, t: { started_at: string; expires_at: string }) => {
          const start = new Date(t.started_at).getTime();
          const end = new Date(t.expires_at).getTime();
          return sum + (end - start) / (1000 * 60 * 60 * 24);
        },
        0,
      );
      avgTrialDurationDays = Math.round(totalDays / trials.length);
    }

    return {
      activeTrials: active,
      expiredTrials: expired,
      convertedTrials: converted,
      cancelledTrials: cancelled,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgTrialDurationDays,
    };
  }

  private async getFeatureUsageSnapshot(
    since: string,
  ): Promise<FeatureUsageSnapshot> {
    const client = this.supabase.getClient();

    const { data: topEvents } = await client
      .from('analytics_events')
      .select('event_name, user_id')
      .gte('created_at', since);

    const eventCounts: Record<
      string,
      { count: number; users: Set<string> }
    > = {};
    (topEvents || []).forEach(
      (e: { event_name: string; user_id?: string }) => {
        const name = e.event_name;
        if (!eventCounts[name]) {
          eventCounts[name] = { count: 0, users: new Set() };
        }
        eventCounts[name].count++;
        if (e.user_id) {
          eventCounts[name].users.add(e.user_id);
        }
      },
    );

    const topEventsByCount = Object.entries(eventCounts)
      .map(([eventName, { count, users }]) => ({
        eventName,
        count,
        uniqueUsers: users.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const { data: tierEvents } = await client
      .from('analytics_events')
      .select('user_tier')
      .gte('created_at', since);

    const eventsByTier: Record<string, number> = {};
    (tierEvents || []).forEach((e: { user_tier: string }) => {
      const tier = e.user_tier || 'unknown';
      eventsByTier[tier] = (eventsByTier[tier] || 0) + 1;
    });

    return { topEventsByCount, eventsByTier, recentTrend: [] };
  }

  private async getTierMatrix(): Promise<Record<string, unknown>> {
    const client = this.supabase.getClient();

    const [{ data: features }, { data: tiers }, { data: tierFeatures }] =
      await Promise.all([
        client
          .from('feature_definitions')
          .select('id, slug, name, category, value_type')
          .eq('is_active', true),
        client
          .from('subscription_tiers')
          .select('id, slug, name')
          .eq('is_active', true)
          .order('display_order'),
        client.from('tier_features').select('tier_id, feature_id, value'),
      ]);

    return { features, tiers, tierFeatures };
  }

  private async getUserAggregates(since: string): Promise<UserAggregates> {
    const client = this.supabase.getClient();

    const [totalResult, tierResult, recentResult, activeResult, paidResult] =
      await Promise.all([
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true }),
        client.from('user_profiles').select('subscription_tier'),
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since),
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .gte('last_login_at', since),
        client
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .in('subscription_tier', ['pro', 'enterprise'])
          .eq('subscription_status', 'active'),
      ]);

    const usersByTier: Record<string, number> = {};
    (tierResult.data || []).forEach(
      (u: { subscription_tier: string }) => {
        const tier = u.subscription_tier || 'free';
        usersByTier[tier] = (usersByTier[tier] || 0) + 1;
      },
    );

    return {
      totalUsers: totalResult.count || 0,
      usersByTier,
      recentSignups30d: recentResult.count || 0,
      activeUsers30d: activeResult.count || 0,
      paidUsers: paidResult.count || 0,
    };
  }

  private emptyGrowthProgress(): GrowthProgress {
    return {
      goal: {
        id: '',
        name: 'No active goal',
        targetPaidUsers: 0,
        targetDate: '',
        milestones: [],
        isActive: false,
      },
      currentPaidUsers: 0,
      daysRemaining: 0,
      currentGrowthRate: 0,
      requiredGrowthRate: 0,
      milestoneProgress: [],
    };
  }

  // --- System Prompt ---

  private buildSystemPrompt(
    snapshot: InsightsDataSnapshot,
    days: number,
  ): string {
    const { growthProgress, userAggregates, revenueData } = snapshot;
    const gp = growthProgress;

    const productContext = buildProductContext({
      totalUsers: userAggregates.totalUsers,
      paidUsers: userAggregates.paidUsers,
      activeUsers30d: userAggregates.activeUsers30d,
      hasAnyRealRevenue: (revenueData.estimatedMrr || 0) > 0,
    });

    return `You are the Growth Director for PropertyIQ. You have been hired as a fractional CMO to grow this platform from zero to scale.

MISSION: Help PropertyIQ reach ${gp.goal.targetPaidUsers} average monthly paid users by ${gp.goal.targetDate ? new Date(gp.goal.targetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' , year: 'numeric' }) : 'TBD'}.
Current: ${gp.currentPaidUsers} paid users | ${gp.daysRemaining} days remaining
Required growth rate: ${gp.requiredGrowthRate} users/day | Current rate: ${gp.currentGrowthRate} users/day (30d avg)
Gap: ${gp.requiredGrowthRate > 0 ? (gp.requiredGrowthRate / Math.max(gp.currentGrowthRate, 0.01)).toFixed(1) : '0'}x acceleration needed

ABOUT YOU:
- Expert SaaS growth strategist specializing in real estate data platforms
- The founder is a solo developer, not a marketer — every recommendation MUST include specific, step-by-step implementation instructions a developer can follow
- Provide templates, scripts, example copy, effort estimates, and expected user impact
- Think across three domains: on-site optimization, off-site acquisition, lifecycle/retention
- Advertising and affiliate recommendations must genuinely help the user — never feel forced
- Estimate potential user impact for each recommendation (e.g., "could convert ~15-30 additional users/month")
- Prioritize automation and scalable tactics over manual effort
- You KNOW this product inside and out — reference specific pages, features, scores, and metrics by name
- Do NOT make assumptions about features that don't exist — only recommend changes to actual pages/features listed below
- When suggesting on-site changes, reference the EXACT page route (e.g., "/pricing", "/map", "/reports/builder")

CRITICAL CONTEXT:
- PropertyIQ is a BRAND NEW platform in early launch with very few real users
- Most data in the analytics tables is from INTERNAL TESTING, not organic users
- Low numbers are expected — do NOT treat test data as real user behavior patterns
- Focus recommendations on ACQUIRING FIRST REAL USERS, not optimizing existing funnels
- The founder has done NO marketing yet — no blog, no social media, no content, no outreach
- Every recommendation must be something a developer (not a marketer) can execute

${productContext}

LIVE PLATFORM DATA (last ${days} days — NOTE: mostly test data at this stage):

=== PAYWALL ANALYTICS ===
${JSON.stringify(snapshot.paywallStats, null, 2)}

=== CONVERSION FUNNEL ===
${JSON.stringify(snapshot.funnelData, null, 2)}

=== REVENUE & SUBSCRIPTIONS ===
${JSON.stringify(snapshot.revenueData, null, 2)}

=== TRIAL PERFORMANCE ===
${JSON.stringify(snapshot.trialData, null, 2)}

=== FEATURE USAGE (top events) ===
${JSON.stringify(snapshot.featureUsage, null, 2)}

=== TIER-FEATURE MATRIX ===
${JSON.stringify(snapshot.tierMatrix, null, 2)}

=== USER AGGREGATES ===
${JSON.stringify(snapshot.userAggregates, null, 2)}

OUTPUT FORMAT:
You deeply understand PropertyIQ's product, features, and current early-launch stage.
Analyze the data above and provide insights in these 11 categories, priority-ranked within each.
Skip categories where you have no meaningful insight — don't pad with generic advice.
Given the early stage, heavily weight Acquisition Channels, Brand & Authority, and Quick Wins.

For each insight:
- **[High/Medium/Low] Title**
- Evidence: cite specific numbers from the data OR reference specific PropertyIQ features/pages
- Recommendation: what to do and why — reference actual site pages by route (e.g., "/pricing", "/map")
- Implementation: numbered steps with specific actions a DEVELOPER can follow, effort estimate in hours, and expected user impact
- Do NOT recommend features that already exist. Do NOT describe the product incorrectly.

Categories:
## 🔴 Conversion Blockers
## ⚡ Quick Wins
## 📈 Growth Opportunities
## 🔍 Missing Tracking
## 📊 Retention Signals
## 💰 Pricing & Packaging
## 🧪 Trial Health
## 💸 Revenue Leaks
## 🌐 Acquisition Channels
## 🏛️ Brand & Authority
## 🤝 Monetization & Partnerships

Remember: the founder is a solo developer who will execute your recommendations directly. Be specific. Name real platforms, communities, tools, and subreddits. Give exact copy templates and email scripts. Estimate effort in hours. Reference actual PropertyIQ features and pages. This is their marketing playbook — make it actionable.`;
  }
}
