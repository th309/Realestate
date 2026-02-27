/**
 * AI Insights Service
 *
 * Public API for the AI Insights engine. Orchestrates data gathering
 * (via InsightsDataFetcherService), prompt construction, and LLM
 * streaming (via AiProviderService). Also exposes growth goal progress
 * as a standalone data-only endpoint (no LLM call).
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AiProviderService } from './ai-provider.service';
import { InsightsDataFetcherService } from './insights-data-fetcher.service';
import { GrowthProgressService } from './growth-progress.service';
import {
  AiProvider,
  ChatMessage,
  GrowthProgress,
  InsightsDataSnapshot,
} from './ai-insights.types';
import { buildProductContext } from './site-context';

const FOCUS_AREA_PERSONAS: Record<string, string> = {
  overview:
    'You are a growth strategist. Focus on overall business health, trends, and opportunities.',
  journeys:
    'You are a UX/CRO specialist. Focus on user navigation patterns, friction points, and page optimization.',
  retention:
    'You are an engagement & lifecycle marketer. Focus on cohort retention, churn prevention, and user activation.',
  acquisition:
    'You are a growth/channel marketer. Focus on traffic sources, attribution, and channel optimization.',
  conversion:
    'You are a revenue optimization specialist. Focus on funnel performance, paywall strategy, and upgrade paths.',
};

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly aiProvider: AiProviderService,
    private readonly dataFetcher: InsightsDataFetcherService,
    private readonly growthProgressService: GrowthProgressService,
  ) {}

  /**
   * Stream initial analysis or follow-up response.
   * Gathers all platform data, constructs the system prompt, and streams
   * from the LLM. When focusArea is set, a specialist persona is prepended.
   */
  async *streamInsights(options: {
    days: number;
    provider: AiProvider;
    prompt?: string;
    history?: ChatMessage[];
    focusArea?: string;
  }): AsyncGenerator<string> {
    const { days, provider, prompt, history, focusArea } = options;

    const growthProgress = await this.growthProgressService.getGrowthProgress();
    const snapshot = await this.dataFetcher.gatherSnapshot(
      days,
      growthProgress,
    );
    const systemPrompt = this.buildSystemPrompt(snapshot, days, focusArea);

    const messages: ChatMessage[] = [];

    if (history && history.length > 0) {
      messages.push(...history);
      if (prompt) {
        messages.push({ role: 'user', content: prompt });
      }
    } else if (prompt) {
      messages.push({ role: 'user', content: prompt });
    } else {
      messages.push({
        role: 'user',
        content:
          "Analyze the platform data provided and generate your full marketing insights report across all 11 categories. Prioritize the most impactful findings. Skip categories where you have no meaningful insight — don't pad with generic advice.",
      });
    }

    yield* this.aiProvider.streamCompletion(systemPrompt, messages, provider);
  }

  /**
   * Get growth goal progress (data-driven, no LLM call).
   */
  async getGrowthProgress(): Promise<GrowthProgress> {
    return this.growthProgressService.getGrowthProgress();
  }

  // --- Private: System Prompt ---

  private buildSystemPrompt(
    snapshot: InsightsDataSnapshot,
    days: number,
    focusArea?: string,
  ): string {
    const { growthProgress, userAggregates, revenueData } = snapshot;
    const gp = growthProgress;

    const persona = focusArea ? (FOCUS_AREA_PERSONAS[focusArea] ?? '') : '';

    const productContext = buildProductContext({
      totalUsers: userAggregates.totalUsers,
      paidUsers: userAggregates.paidUsers,
      activeUsers30d: userAggregates.activeUsers30d,
      hasAnyRealRevenue: (revenueData.estimatedMrr || 0) > 0,
    });

    const targetDateLabel = gp.goal.targetDate
      ? new Date(gp.goal.targetDate).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'TBD';

    const growthGap =
      gp.requiredGrowthRate > 0
        ? (
            gp.requiredGrowthRate / Math.max(gp.currentGrowthRate, 0.01)
          ).toFixed(1)
        : '0';

    const analyticsSection = this.buildAnalyticsSection(snapshot);

    return `${persona ? `${persona}\n\n` : ''}You are the Growth Director for PropertyIQ. You have been hired as a fractional CMO to grow this platform from zero to scale.

MISSION: Help PropertyIQ reach ${gp.goal.targetPaidUsers} paid users by ${targetDateLabel}.
Launch date: ${new Date(gp.goal.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} | Day ${gp.daysElapsed} of ${gp.totalDays}
Current: ${gp.currentPaidUsers} paid users | ${gp.daysRemaining} days remaining
Growth rate: ${gp.currentGrowthRate.toFixed(2)} users/day (since launch) | Required: ${gp.requiredGrowthRate.toFixed(2)} users/day
Gap: ${growthGap}x acceleration needed

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
${analyticsSection}
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

  private buildAnalyticsSection(snapshot: InsightsDataSnapshot): string {
    const sections: string[] = [];

    if (snapshot.overview) {
      sections.push(
        `\n=== SITE OVERVIEW (KPIs & Traffic) ===\n${JSON.stringify(snapshot.overview, null, 2)}`,
      );
    }
    if (snapshot.journeys) {
      sections.push(
        `\n=== USER JOURNEY INTELLIGENCE ===\n${JSON.stringify(snapshot.journeys, null, 2)}`,
      );
    }
    if (snapshot.retention) {
      sections.push(
        `\n=== RETENTION HEALTH ===\n${JSON.stringify(snapshot.retention, null, 2)}`,
      );
    }
    if (snapshot.acquisition) {
      sections.push(
        `\n=== ACQUISITION PERFORMANCE ===\n${JSON.stringify(snapshot.acquisition, null, 2)}`,
      );
    }
    if (snapshot.conversion) {
      sections.push(
        `\n=== CONVERSION INSIGHTS ===\n${JSON.stringify(snapshot.conversion, null, 2)}`,
      );
    }

    return sections.length > 0 ? sections.join('\n') + '\n' : '';
  }
}
