# AI Marketing Insights Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hardcoded AI Insights section on `/admin/entitlements/analytics` with a real-time AI-powered growth strategist that analyzes all platform data and provides actionable, implementation-ready marketing recommendations.

**Architecture:** SSE streaming endpoint on the NestJS backend gathers data from 7 sources (paywall events, funnel, Stripe, trials, feature usage, tier matrix, user aggregates), injects them into a structured system prompt, and streams the LLM response (DeepSeek default, Claude toggle) to the frontend. The frontend renders the streaming markdown into categorized insight cards with a chat interface for follow-ups. A data-driven goal progress widget tracks milestone progress toward 2,000 paid users by Feb 2, 2027.

**Tech Stack:** NestJS (backend), OpenAI SDK (DeepSeek), Anthropic SDK (Claude), Server-Sent Events, React, Tailwind/M3, Supabase (PostgreSQL)

**Design Doc:** `docs/plans/2026-02-24-ai-marketing-insights-engine-design.md`

---

## Task 1: Create growth_goals table migration

**Files:**
- Create: `scripts/migrations/110-create-growth-goals-table.sql`

**Step 1: Write the migration SQL**

```sql
-- Growth goals configuration table
-- Stores the target user count, deadline, and milestones for the AI marketing insights engine
CREATE TABLE IF NOT EXISTS growth_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL DEFAULT 'primary',
  target_paid_users INTEGER NOT NULL,
  target_date TIMESTAMPTZ NOT NULL,
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only one active goal at a time
CREATE UNIQUE INDEX idx_growth_goals_active ON growth_goals (is_active) WHERE is_active = true;

-- Seed the initial goal: 2,000 paid users by Feb 2, 2027
INSERT INTO growth_goals (name, target_paid_users, target_date, milestones, is_active)
VALUES (
  'primary',
  2000,
  '2027-02-02T00:00:00Z',
  '[
    {"target": 10, "label": "First 10"},
    {"target": 25, "label": "Early Adopters"},
    {"target": 100, "label": "Product-Market Fit"},
    {"target": 250, "label": "Growth Phase"},
    {"target": 500, "label": "Scale Phase"},
    {"target": 1000, "label": "Halfway"},
    {"target": 2000, "label": "Goal"}
  ]'::jsonb,
  true
);
```

**Step 2: Apply the migration via Supabase**

Run the migration against the project database using the Supabase MCP tool `apply_migration`.

**Step 3: Verify the table exists**

Run: `SELECT * FROM growth_goals WHERE is_active = true;` via Supabase MCP `execute_sql`.
Expected: One row with target_paid_users=2000.

**Step 4: Commit**

```bash
git add scripts/migrations/110-create-growth-goals-table.sql
git commit -m "feat: add growth_goals table for AI marketing insights milestone tracking"
```

---

## Task 2: Create backend types

**Files:**
- Create: `packages/backend/src/admin/analytics/ai-insights.types.ts`

**Step 1: Write the types file**

```typescript
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
```

**Step 2: Commit**

```bash
git add packages/backend/src/admin/analytics/ai-insights.types.ts
git commit -m "feat: add types for AI marketing insights engine"
```

---

## Task 3: Create AI provider abstraction service

This service wraps DeepSeek (via OpenAI SDK) and Anthropic (Claude) behind a single streaming interface. Follow the existing patterns in:
- DeepSeek: `packages/backend/src/reports/claude.service.ts` (lines 42-56) — uses OpenAI SDK with DeepSeek base URL
- Anthropic: `packages/backend/src/analytics-chat/providers/anthropic.provider.ts` (lines 16-127) — streaming with async generator

**Files:**
- Create: `packages/backend/src/admin/analytics/ai-provider.service.ts`

**Step 1: Write the provider service**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { AiProvider, ChatMessage } from './ai-insights.types';

/**
 * Abstraction over DeepSeek and Claude for streaming LLM completions.
 * Routes to the correct SDK based on provider selection.
 */
@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private deepseekClient: OpenAI | null = null;
  private anthropicClient: Anthropic | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeClients();
  }

  private initializeClients(): void {
    const deepseekKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    if (deepseekKey) {
      this.deepseekClient = new OpenAI({
        apiKey: deepseekKey,
        baseURL:
          this.configService.get<string>('DEEPSEEK_BASE_URL') ||
          'https://api.deepseek.com/v1',
      });
      this.logger.log('DeepSeek client initialized');
    }

    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
      this.logger.log('Anthropic client initialized');
    }
  }

  async *streamCompletion(
    systemPrompt: string,
    messages: ChatMessage[],
    provider: AiProvider,
  ): AsyncGenerator<string> {
    if (provider === 'deepseek') {
      yield* this.streamDeepSeek(systemPrompt, messages);
    } else {
      yield* this.streamClaude(systemPrompt, messages);
    }
  }

  private async *streamDeepSeek(
    systemPrompt: string,
    messages: ChatMessage[],
  ): AsyncGenerator<string> {
    if (!this.deepseekClient) {
      throw new Error('DeepSeek client not initialized — check DEEPSEEK_API_KEY');
    }

    const model =
      this.configService.get<string>('DEEPSEEK_MODEL') || 'deepseek-chat';

    const stream = await this.deepseekClient.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  private async *streamClaude(
    systemPrompt: string,
    messages: ChatMessage[],
  ): AsyncGenerator<string> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized — check ANTHROPIC_API_KEY');
    }

    const model =
      this.configService.get<string>('CLAUDE_INSIGHTS_MODEL') ||
      'claude-sonnet-4-6-20250514';

    const stream = await this.anthropicClient.messages.stream({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      temperature: 0.7,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }

  getAvailableProviders(): AiProvider[] {
    const available: AiProvider[] = [];
    if (this.deepseekClient) available.push('deepseek');
    if (this.anthropicClient) available.push('claude');
    return available;
  }
}
```

**Step 2: Verify it compiles**

Run: `cd packages/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in ai-provider.service.ts

**Step 3: Commit**

```bash
git add packages/backend/src/admin/analytics/ai-provider.service.ts
git commit -m "feat: add AI provider abstraction for DeepSeek and Claude streaming"
```

---

## Task 4: Create AI insights data assembly service

This is the core service. It:
1. Gathers data from 7 sources in parallel
2. Calculates growth progress against the goal
3. Constructs the system prompt with persona + data + goal
4. Delegates to AiProviderService for streaming

**Files:**
- Create: `packages/backend/src/admin/analytics/ai-insights.service.ts`

**Dependencies to inject:**
- `SupabaseService` (from `packages/backend/src/supabase/supabase.service.ts`)
- `PaywallAnalyticsService` (from same analytics module)
- `AiProviderService` (from Task 3)
- `ConfigService` (from NestJS)

**Step 1: Write the service**

```typescript
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
      Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    // Calculate growth rates
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const { count: newPaidLast30d } = await client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .in('subscription_tier', ['pro', 'enterprise'])
      .eq('subscription_status', 'active')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const currentGrowthRate = (newPaidLast30d || 0) / 30;
    const usersNeeded = goal.target_paid_users - currentPaidUsers;
    const requiredGrowthRate = daysRemaining > 0 ? usersNeeded / daysRemaining : 0;

    // Calculate milestone progress
    const milestones: MilestoneStatus[] = (goal.milestones || []).map(
      (m: { target: number; label: string }) => {
        const reached = currentPaidUsers >= m.target;
        let projectedDate: string | undefined;
        if (!reached && currentGrowthRate > 0) {
          const daysToReach = (m.target - currentPaidUsers) / currentGrowthRate;
          const projected = new Date(now.getTime() + daysToReach * 24 * 60 * 60 * 1000);
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

  private async gatherDataSnapshot(days: number): Promise<InsightsDataSnapshot> {
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
      this.paywallAnalytics.getStats({ startDate: startIso, endDate: endIso }),
      this.paywallAnalytics.getFunnelData({ startDate: startIso, endDate: endIso }),
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

    const [paidResult, tierResult, failedResult, churnResult] = await Promise.all([
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
    ]);

    // Count users by tier for MRR estimate
    const tierCounts: Record<string, number> = {};
    (tierResult.data || []).forEach((u) => {
      const tier = u.subscription_tier || 'unknown';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    // Estimate MRR: Pro=$29, Enterprise=$99
    const estimatedMrr =
      (tierCounts['pro'] || 0) * 29 + (tierCounts['enterprise'] || 0) * 99;

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

    const [activeResult, expiredResult, convertedResult, cancelledResult] =
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
      ]);

    const active = activeResult.count || 0;
    const expired = expiredResult.count || 0;
    const converted = convertedResult.count || 0;
    const cancelled = cancelledResult.count || 0;
    const totalCompleted = expired + converted + cancelled;
    const conversionRate = totalCompleted > 0 ? (converted / totalCompleted) * 100 : 0;

    return {
      activeTrials: active,
      expiredTrials: expired,
      convertedTrials: converted,
      cancelledTrials: cancelled,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgTrialDurationDays: 14, // From trial_config default
    };
  }

  private async getFeatureUsageSnapshot(
    since: string,
  ): Promise<FeatureUsageSnapshot> {
    const client = this.supabase.getClient();

    // Top events by count
    const { data: topEvents } = await client
      .from('analytics_events')
      .select('event_name')
      .gte('created_at', since);

    // Aggregate event counts
    const eventCounts: Record<string, { count: number; users: Set<string> }> = {};
    (topEvents || []).forEach((e: Record<string, string>) => {
      const name = e.event_name;
      if (!eventCounts[name]) {
        eventCounts[name] = { count: 0, users: new Set() };
      }
      eventCounts[name].count++;
    });

    const topEventsByCount = Object.entries(eventCounts)
      .map(([eventName, { count, users }]) => ({
        eventName,
        count,
        uniqueUsers: users.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Events by tier
    const { data: tierEvents } = await client
      .from('analytics_events')
      .select('user_tier')
      .gte('created_at', since);

    const eventsByTier: Record<string, number> = {};
    (tierEvents || []).forEach((e: Record<string, string>) => {
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
        client.from('user_profiles').select('*', { count: 'exact', head: true }),
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
      (u: Record<string, string>) => {
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

  private buildSystemPrompt(snapshot: InsightsDataSnapshot, days: number): string {
    const { growthProgress } = snapshot;
    const gp = growthProgress;

    return `You are the Growth Director for PropertyIQ, a real estate analytics SaaS platform.

MISSION: Help PropertyIQ reach ${gp.goal.targetPaidUsers} average monthly paid users by ${gp.goal.targetDate ? new Date(gp.goal.targetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'}.
Current: ${gp.currentPaidUsers} paid users | ${gp.daysRemaining} days remaining
Required growth rate: ${gp.requiredGrowthRate} users/day | Current rate: ${gp.currentGrowthRate} users/day (30d avg)
Gap: ${gp.requiredGrowthRate > 0 ? (gp.requiredGrowthRate / Math.max(gp.currentGrowthRate, 0.01)).toFixed(1) : '0'}x acceleration needed

ABOUT YOU:
- Expert SaaS growth strategist specializing in real estate data platforms
- The founder is a developer, not a marketer — every recommendation MUST include specific, step-by-step implementation instructions
- Provide templates, scripts, example copy, effort estimates, and expected user impact
- Think across three domains: on-site optimization, off-site acquisition, lifecycle/retention
- Advertising and affiliate recommendations must genuinely help the user — never feel forced
- Estimate potential user impact for each recommendation (e.g., "could convert ~15-30 additional users/month")
- Prioritize automation and scalable tactics over manual effort

PLATFORM DATA (last ${days} days):

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
Analyze the data and provide insights in these 11 categories, priority-ranked within each.
Skip categories where you have no meaningful insight — don't pad with generic advice.

For each insight:
- **[High/Medium/Low] Title**
- Evidence: cite specific numbers from the data above
- Recommendation: what to do and why
- Implementation: numbered steps with specific actions, effort estimate, and expected user impact

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

Remember: the founder will execute your recommendations directly. Be specific. Name real platforms, communities, tools. Give exact copy templates. Estimate effort in hours. This is their marketing playbook.`;
  }
}
```

**Step 2: Verify it compiles**

Run: `cd packages/backend && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in ai-insights.service.ts

**Step 3: Commit**

```bash
git add packages/backend/src/admin/analytics/ai-insights.service.ts
git commit -m "feat: add AI insights service with data assembly and system prompt"
```

---

## Task 5: Create AI insights SSE controller

Follow the existing SSE pattern from `packages/backend/src/analytics-chat/analytics-chat.controller.ts` (lines 76-120).

**Files:**
- Create: `packages/backend/src/admin/analytics/ai-insights.controller.ts`

**Step 1: Write the controller**

```typescript
import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { AiInsightsService } from './ai-insights.service';
import { AiInsightsQueryDto, AiProvider, ChatMessage } from './ai-insights.types';

@UseGuards(AdminGuard)
@Controller('api/admin/analytics')
export class AiInsightsController {
  private readonly logger = new Logger(AiInsightsController.name);

  constructor(private readonly aiInsights: AiInsightsService) {}

  /**
   * SSE streaming endpoint for AI marketing insights.
   * Streams the LLM response as Server-Sent Events.
   */
  @Get('ai-insights')
  async streamInsights(
    @Query() query: AiInsightsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const days = Number(query.days) || 30;
    const provider: AiProvider = query.provider === 'claude' ? 'claude' : 'deepseek';

    let history: ChatMessage[] = [];
    if (query.history) {
      try {
        history = JSON.parse(query.history);
      } catch {
        this.logger.warn('Invalid history JSON, ignoring');
      }
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const stream = this.aiInsights.streamInsights({
        days,
        provider,
        prompt: query.prompt,
        history,
      });

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (error) {
      this.logger.error('AI insights stream error', error);
      res.write(
        `data: ${JSON.stringify({ type: 'error', content: error.message || 'Stream failed' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  /**
   * Get growth goal progress (data-driven, no LLM).
   */
  @Get('growth-progress')
  async getGrowthProgress() {
    try {
      return await this.aiInsights.getGrowthProgress();
    } catch (error) {
      this.logger.error('Growth progress error', error);
      throw new HttpException(
        'Failed to fetch growth progress',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
```

**Step 2: Verify it compiles**

Run: `cd packages/backend && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add packages/backend/src/admin/analytics/ai-insights.controller.ts
git commit -m "feat: add SSE streaming controller for AI marketing insights"
```

---

## Task 6: Register new services in analytics module

**Files:**
- Modify: `packages/backend/src/admin/analytics/analytics.module.ts`

**Step 1: Update the module registration**

The existing module at `packages/backend/src/admin/analytics/analytics.module.ts` registers `PaywallAnalyticsController` and `PaywallAnalyticsService`. Add the new controller and services.

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../../supabase/supabase.module';
import { PaywallAnalyticsController } from './paywall-analytics.controller';
import { PaywallAnalyticsService } from './paywall-analytics.service';
import { AiInsightsController } from './ai-insights.controller';
import { AiInsightsService } from './ai-insights.service';
import { AiProviderService } from './ai-provider.service';

@Module({
  imports: [SupabaseModule, ConfigModule],
  controllers: [PaywallAnalyticsController, AiInsightsController],
  providers: [PaywallAnalyticsService, AiInsightsService, AiProviderService],
  exports: [PaywallAnalyticsService, AiInsightsService],
})
export class AnalyticsModule {}
```

**Step 2: Verify the backend builds**

Run: `cd packages/backend && npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/backend/src/admin/analytics/analytics.module.ts
git commit -m "feat: register AI insights controller and services in analytics module"
```

---

## Task 7: Create frontend SSE hook (useAiInsights)

**Files:**
- Create: `packages/frontend/app/admin/entitlements/analytics/hooks/useAiInsights.ts`

**Step 1: Write the hook**

This hook handles SSE streaming from the backend, markdown accumulation, and chat history management. Follow the existing data fetching pattern using `fetchAPIRaw` from `@/lib/data`.

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';
import { fetchAPIRaw } from '@/lib/data';

type AiProvider = 'deepseek' | 'claude';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UseAiInsightsOptions {
  days: number;
  provider: AiProvider;
}

interface UseAiInsightsReturn {
  /** Accumulated markdown from the current stream */
  content: string;
  /** Whether the stream is actively generating */
  isStreaming: boolean;
  /** Error message if stream failed */
  error: string | null;
  /** Chat conversation history */
  chatHistory: ChatMessage[];
  /** Generate initial insights report */
  generateInsights: () => Promise<void>;
  /** Send a follow-up chat message */
  sendFollowUp: (message: string) => Promise<void>;
  /** Clear chat history and content */
  reset: () => void;
}

export function useAiInsights({
  days,
  provider,
}: UseAiInsightsOptions): UseAiInsightsReturn {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const streamFromEndpoint = useCallback(
    async (params: Record<string, string>, appendToChat: boolean) => {
      // Abort any existing stream
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const abortController = new AbortController();
      abortRef.current = abortController;

      setIsStreaming(true);
      setError(null);

      if (!appendToChat) {
        setContent('');
      }

      let accumulated = '';

      try {
        const queryString = new URLSearchParams(params).toString();
        const response = await fetchAPIRaw(
          `/api/admin/analytics/ai-insights?${queryString}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'text' && parsed.content) {
                accumulated += parsed.content;
                setContent((prev) =>
                  appendToChat ? prev : accumulated,
                );
                if (appendToChat) {
                  // Update the last assistant message in chat history
                  setChatHistory((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                      updated[lastIdx] = {
                        ...updated[lastIdx],
                        content: accumulated,
                      };
                    }
                    return updated;
                  });
                }
              } else if (parsed.type === 'error') {
                setError(parsed.content || 'Stream error');
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        // If initial analysis, store as first assistant message
        if (!appendToChat && accumulated) {
          setContent(accumulated);
          setChatHistory([{ role: 'assistant', content: accumulated }]);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message || 'Failed to stream insights');
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [],
  );

  const generateInsights = useCallback(async () => {
    setChatHistory([]);
    await streamFromEndpoint(
      { days: String(days), provider },
      false,
    );
  }, [days, provider, streamFromEndpoint]);

  const sendFollowUp = useCallback(
    async (message: string) => {
      // Add user message and placeholder assistant message
      setChatHistory((prev) => [
        ...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: '' },
      ]);

      const historyForApi = chatHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await streamFromEndpoint(
        {
          days: String(days),
          provider,
          prompt: message,
          history: JSON.stringify(historyForApi),
        },
        true,
      );
    },
    [days, provider, chatHistory, streamFromEndpoint],
  );

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setContent('');
    setChatHistory([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  return {
    content,
    isStreaming,
    error,
    chatHistory,
    generateInsights,
    sendFollowUp,
    reset,
  };
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/admin/entitlements/analytics/hooks/useAiInsights.ts
git commit -m "feat: add useAiInsights SSE streaming hook for frontend"
```

---

## Task 8: Create GoalProgressWidget component

**Files:**
- Create: `packages/frontend/app/admin/entitlements/analytics/components/GoalProgressWidget.tsx`

**Step 1: Write the component**

This is a data-driven widget (no LLM). It fetches from `GET /api/admin/analytics/growth-progress` and renders the milestone timeline.

```typescript
'use client';

import { useEffect, useState } from 'react';
import { fetchAPIRaw } from '@/lib/data';
import { Target, TrendingUp, CheckCircle, Circle, Loader2 } from 'lucide-react';

interface MilestoneStatus {
  target: number;
  label: string;
  reached: boolean;
  reachedAt?: string;
  projectedDate?: string;
}

interface GrowthProgressData {
  goal: {
    targetPaidUsers: number;
    targetDate: string;
    isActive: boolean;
  };
  currentPaidUsers: number;
  daysRemaining: number;
  currentGrowthRate: number;
  requiredGrowthRate: number;
  milestoneProgress: MilestoneStatus[];
}

export function GoalProgressWidget() {
  const [data, setData] = useState<GrowthProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const response = await fetchAPIRaw('/api/admin/analytics/growth-progress');
        if (response.ok) {
          setData(await response.json());
        }
      } catch {
        // Silently fail — widget is supplementary
      } finally {
        setLoading(false);
      }
    }
    fetchProgress();
  }, []);

  if (loading) {
    return (
      <div className="bg-surface-container rounded-xl p-6 border border-outline-variant animate-pulse">
        <div className="h-6 bg-surface-container-high rounded w-1/3 mb-4" />
        <div className="h-4 bg-surface-container-high rounded w-full mb-2" />
        <div className="h-4 bg-surface-container-high rounded w-2/3" />
      </div>
    );
  }

  if (!data || !data.goal.isActive) return null;

  const progressPercent = Math.min(
    100,
    (data.currentPaidUsers / data.goal.targetPaidUsers) * 100,
  );
  const targetDate = new Date(data.goal.targetDate);
  const gapMultiplier =
    data.currentGrowthRate > 0
      ? data.requiredGrowthRate / data.currentGrowthRate
      : Infinity;

  return (
    <div className="bg-surface-container rounded-xl p-6 border border-outline-variant">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-medium text-on-surface">
            Goal: {data.goal.targetPaidUsers.toLocaleString()} Paid Users by{' '}
            {targetDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </h3>
        </div>
        <span className="text-sm text-on-surface-variant">
          {data.daysRemaining} days remaining
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-on-surface font-medium">
            {data.currentPaidUsers} paid users
          </span>
          <span className="text-on-surface-variant">
            {progressPercent.toFixed(1)}%
          </span>
        </div>
        <div className="h-3 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Milestones */}
      <div className="flex flex-wrap gap-3 mb-4">
        {data.milestoneProgress.map((m) => (
          <div
            key={m.target}
            className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border ${
              m.reached
                ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400'
                : 'bg-surface border-outline-variant text-on-surface-variant'
            }`}
          >
            {m.reached ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Circle className="w-3.5 h-3.5" />
            )}
            <span>{m.target.toLocaleString()}</span>
            {m.reached && m.reachedAt && (
              <span className="text-xs opacity-75">
                {new Date(m.reachedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
            {!m.reached && m.projectedDate && (
              <span className="text-xs opacity-75">
                ~{new Date(m.projectedDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Growth rate */}
      <div className="flex items-center gap-4 text-sm text-on-surface-variant">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-4 h-4" />
          <span>
            Growth: <strong>{data.currentGrowthRate}</strong>/day (30d avg)
          </span>
        </div>
        <span>|</span>
        <span>
          Need: <strong>{data.requiredGrowthRate}</strong>/day
        </span>
        {gapMultiplier > 1 && isFinite(gapMultiplier) && (
          <>
            <span>|</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {gapMultiplier.toFixed(1)}x acceleration needed
            </span>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/admin/entitlements/analytics/components/GoalProgressWidget.tsx
git commit -m "feat: add GoalProgressWidget with milestone timeline"
```

---

## Task 9: Create InsightCategoryCard component

**Files:**
- Create: `packages/frontend/app/admin/entitlements/analytics/components/InsightCategoryCard.tsx`

**Step 1: Write the component**

Renders a single collapsible category of insights parsed from the LLM's markdown output.

```typescript
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface InsightCategoryCardProps {
  icon: string;
  title: string;
  content: string;
  defaultOpen?: boolean;
}

export function InsightCategoryCard({
  icon,
  title,
  content,
  defaultOpen = true,
}: InsightCategoryCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!content.trim()) return null;

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface-container-high transition-colors"
      >
        <span className="text-xl">{icon}</span>
        <h4 className="text-base font-medium text-on-surface flex-1 text-left">
          {title}
        </h4>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-on-surface-variant" />
        ) : (
          <ChevronRight className="w-5 h-5 text-on-surface-variant" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 prose prose-sm dark:prose-invert max-w-none">
          <div
            className="text-on-surface-variant leading-relaxed [&_strong]:text-on-surface [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-3 [&_h3]:mb-1 [&_ol]:pl-4 [&_ul]:pl-4 [&_li]:mb-2"
            dangerouslySetInnerHTML={{ __html: parseInsightMarkdown(content) }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Minimal markdown → HTML for insight content.
 * Handles: bold, lists, numbered lists, line breaks.
 * Not a full markdown parser — just enough for the LLM's insight format.
 */
function parseInsightMarkdown(md: string): string {
  return md
    .replace(/\*\*\[([^\]]+)\]\s*([^*]+)\*\*/g, '<strong class="inline-flex items-center gap-1"><span class="px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-semibold">$1</span> $2</strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^\d+\.\s+/gm, (match) => `<li>${match.replace(/^\d+\.\s+/, '')}`)
    .replace(/^- /gm, '<li>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/admin/entitlements/analytics/components/InsightCategoryCard.tsx
git commit -m "feat: add collapsible InsightCategoryCard component"
```

---

## Task 10: Create AiInsightsPanel component

This is the main container that orchestrates the streaming insights display.

**Files:**
- Create: `packages/frontend/app/admin/entitlements/analytics/components/AiInsightsPanel.tsx`

**Step 1: Write the component**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Brain, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useAiInsights } from '../hooks/useAiInsights';
import { InsightCategoryCard } from './InsightCategoryCard';
import { InsightsChat } from './InsightsChat';

type AiProvider = 'deepseek' | 'claude';

interface AiInsightsPanelProps {
  days: number;
}

const CATEGORIES = [
  { icon: '🔴', header: '## 🔴 Conversion Blockers', title: 'Conversion Blockers' },
  { icon: '⚡', header: '## ⚡ Quick Wins', title: 'Quick Wins' },
  { icon: '📈', header: '## 📈 Growth Opportunities', title: 'Growth Opportunities' },
  { icon: '🔍', header: '## 🔍 Missing Tracking', title: 'Missing Tracking' },
  { icon: '📊', header: '## 📊 Retention Signals', title: 'Retention Signals' },
  { icon: '💰', header: '## 💰 Pricing & Packaging', title: 'Pricing & Packaging' },
  { icon: '🧪', header: '## 🧪 Trial Health', title: 'Trial Health' },
  { icon: '💸', header: '## 💸 Revenue Leaks', title: 'Revenue Leaks' },
  { icon: '🌐', header: '## 🌐 Acquisition Channels', title: 'Acquisition Channels' },
  { icon: '🏛️', header: '## 🏛️ Brand & Authority', title: 'Brand & Authority' },
  { icon: '🤝', header: '## 🤝 Monetization & Partnerships', title: 'Monetization & Partnerships' },
];

/**
 * Parse the streaming markdown into category sections.
 * Splits on category headers (## emoji Title).
 */
function parseCategorySections(
  markdown: string,
): Array<{ title: string; icon: string; content: string }> {
  const sections: Array<{ title: string; icon: string; content: string }> = [];

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    const headerIndex = markdown.indexOf(cat.header);
    if (headerIndex === -1) continue;

    const contentStart = headerIndex + cat.header.length;

    // Find where the next category starts
    let contentEnd = markdown.length;
    for (let j = i + 1; j < CATEGORIES.length; j++) {
      const nextIndex = markdown.indexOf(CATEGORIES[j].header, contentStart);
      if (nextIndex !== -1) {
        contentEnd = nextIndex;
        break;
      }
    }

    const content = markdown.slice(contentStart, contentEnd).trim();
    if (content) {
      sections.push({ title: cat.title, icon: cat.icon, content });
    }
  }

  return sections;
}

export function AiInsightsPanel({ days }: AiInsightsPanelProps) {
  const [provider, setProvider] = useState<AiProvider>('deepseek');
  const {
    content,
    isStreaming,
    error,
    chatHistory,
    generateInsights,
    sendFollowUp,
    reset,
  } = useAiInsights({ days, provider });

  const sections = parseCategorySections(content);
  const hasContent = content.length > 0;

  return (
    <div className="mt-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-medium text-on-surface">
            AI Marketing Insights
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {/* Provider toggle */}
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as AiProvider);
              reset();
            }}
            className="text-sm bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-on-surface"
          >
            <option value="deepseek">DeepSeek</option>
            <option value="claude">Claude</option>
          </select>

          {/* Generate / Refresh */}
          <button
            onClick={generateInsights}
            disabled={isStreaming}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {hasContent ? 'Refresh Analysis' : 'Generate Insights'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button
            onClick={generateInsights}
            className="ml-auto text-sm font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Streaming indicator (before first category appears) */}
      {isStreaming && !hasContent && (
        <div className="flex items-center gap-3 p-6 bg-surface-container rounded-xl border border-outline-variant">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-on-surface-variant">
            Gathering platform data and generating insights...
          </span>
        </div>
      )}

      {/* Empty state */}
      {!isStreaming && !hasContent && !error && (
        <div className="text-center py-12 bg-surface-container rounded-xl border border-outline-variant">
          <Brain className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-3" />
          <p className="text-on-surface-variant">
            Click &quot;Generate Insights&quot; to analyze your platform data
          </p>
          <p className="text-sm text-on-surface-variant/60 mt-1">
            The AI will review paywall events, revenue, trials, and feature
            usage to create your marketing playbook.
          </p>
        </div>
      )}

      {/* Insight category cards */}
      {sections.length > 0 && (
        <div className="space-y-3">
          {sections.map((section) => (
            <InsightCategoryCard
              key={section.title}
              icon={section.icon}
              title={section.title}
              content={section.content}
            />
          ))}
        </div>
      )}

      {/* Streaming partial content (before it's parseable into categories) */}
      {isStreaming && hasContent && sections.length === 0 && (
        <div className="bg-surface-container rounded-xl border border-outline-variant p-4">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-on-surface-variant">Generating...</span>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-on-surface-variant whitespace-pre-wrap">
            {content}
          </div>
        </div>
      )}

      {/* Chat interface (shown after initial insights are generated) */}
      {hasContent && !isStreaming && (
        <InsightsChat
          chatHistory={chatHistory}
          onSendMessage={sendFollowUp}
          isStreaming={isStreaming}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/admin/entitlements/analytics/components/AiInsightsPanel.tsx
git commit -m "feat: add AiInsightsPanel with streaming category cards and provider toggle"
```

---

## Task 11: Create InsightsChat component

**Files:**
- Create: `packages/frontend/app/admin/entitlements/analytics/components/InsightsChat.tsx`

**Step 1: Write the component**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface InsightsChatProps {
  chatHistory: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  isStreaming: boolean;
}

export function InsightsChat({
  chatHistory,
  onSendMessage,
  isStreaming,
}: InsightsChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || isStreaming) return;
    setInput('');
    await onSendMessage(message);
  };

  // Only show follow-up messages (skip the initial analysis which is message index 0)
  const followUpMessages = chatHistory.slice(1);
  const hasFollowUps = followUpMessages.length > 0;

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
      {/* Chat history (only follow-ups) */}
      {hasFollowUps && (
        <div
          ref={scrollRef}
          className="max-h-96 overflow-y-auto p-4 space-y-4 border-b border-outline-variant"
        >
          {followUpMessages.map((msg, i) => (
            <div key={i} className="flex gap-3">
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-secondary/10 text-secondary'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                {msg.content || (
                  <span className="text-on-surface-variant/50 italic">
                    Thinking...
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-3 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a follow-up question..."
          disabled={isStreaming}
          className="flex-1 bg-surface border border-outline-variant rounded-full px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/admin/entitlements/analytics/components/InsightsChat.tsx
git commit -m "feat: add InsightsChat follow-up conversation component"
```

---

## Task 12: Wire everything into analytics page

Replace the hardcoded AI Insights section (lines ~479-508) with the new components.

**Files:**
- Modify: `packages/frontend/app/admin/entitlements/analytics/page.tsx`

**Step 1: Add imports**

At the top of the file, add imports for the new components:

```typescript
import { GoalProgressWidget } from './components/GoalProgressWidget';
import { AiInsightsPanel } from './components/AiInsightsPanel';
```

**Step 2: Add GoalProgressWidget before the metric cards**

Insert the `<GoalProgressWidget />` component early in the page layout, before the 4 metric cards grid. Place it right after the page header/date-range-selector section.

**Step 3: Replace the hardcoded AI Insights section**

Remove lines ~479-508 (the entire `{/* Insights Section */}` block with the hardcoded insights). Replace with:

```tsx
{/* AI Marketing Insights */}
<AiInsightsPanel days={days} />
```

Where `days` is the current date range state variable already used on the page.

**Step 4: Verify the page builds**

Run: `cd packages/frontend && npx next build 2>&1 | tail -20`
Expected: No build errors

**Step 5: Commit**

```bash
git add packages/frontend/app/admin/entitlements/analytics/page.tsx
git commit -m "feat: replace hardcoded AI insights with live AI marketing insights engine"
```

---

## Task 13: Manual integration verification

**Step 1: Start the backend**

Run: `cd packages/backend && npm run start:dev`
Expected: Server starts on port 3001, logs show "AiProviderService" initialization

**Step 2: Start the frontend**

Run: `cd packages/frontend && npm run dev`

**Step 3: Test the growth progress endpoint**

Open browser: `http://localhost:3000/admin/entitlements/analytics`
Expected: GoalProgressWidget renders with current paid user count and milestones

**Step 4: Test the AI insights generation**

Click "Generate Insights". Watch for streaming markdown to appear in categorized cards.
Expected: LLM generates analysis with 11 category sections, each with prioritized insights.

**Step 5: Test the provider toggle**

Switch from DeepSeek to Claude, click "Refresh Analysis".
Expected: New analysis streams from Claude with same format.

**Step 6: Test chat follow-up**

Type a follow-up question like "Which acquisition channel should I start with first?"
Expected: Response streams into the chat area below the insights.

**Step 7: Commit final verification**

If any fixes were needed during verification, commit them with descriptive messages.

---

## Summary of all new/modified files

### New files (10)
| File | Purpose |
|------|---------|
| `scripts/migrations/110-create-growth-goals-table.sql` | Growth goals DB table + seed |
| `packages/backend/src/admin/analytics/ai-insights.types.ts` | TypeScript types |
| `packages/backend/src/admin/analytics/ai-provider.service.ts` | DeepSeek/Claude abstraction |
| `packages/backend/src/admin/analytics/ai-insights.service.ts` | Data assembly + prompt construction |
| `packages/backend/src/admin/analytics/ai-insights.controller.ts` | SSE streaming endpoint |
| `packages/frontend/app/admin/entitlements/analytics/hooks/useAiInsights.ts` | SSE streaming hook |
| `packages/frontend/app/admin/entitlements/analytics/components/GoalProgressWidget.tsx` | Milestone progress widget |
| `packages/frontend/app/admin/entitlements/analytics/components/InsightCategoryCard.tsx` | Collapsible category card |
| `packages/frontend/app/admin/entitlements/analytics/components/AiInsightsPanel.tsx` | Main insights container |
| `packages/frontend/app/admin/entitlements/analytics/components/InsightsChat.tsx` | Chat follow-up interface |

### Modified files (2)
| File | Change |
|------|--------|
| `packages/backend/src/admin/analytics/analytics.module.ts` | Register new controller + services |
| `packages/frontend/app/admin/entitlements/analytics/page.tsx` | Replace hardcoded section + add GoalProgressWidget |
