/**
 * Analytics Chat Intelligence Helpers
 *
 * Pure helper functions for market intelligence lookups used by AnalyticsChatService.
 * Extracted to keep the main service file under the 300-line hard limit.
 *
 * These functions accept dependencies (Supabase client, services) as parameters
 * rather than accessing them via `this`, making them testable and decoupled.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { MarketBriefing } from '../market-intelligence/market-intelligence.types';
import { RankingsCacheService } from '../market-intelligence/rankings-cache.service';
import { BriefingGeneratorService } from '../market-intelligence/briefing-generator.service';
import { AppConfigService } from '../config/app-config.service';

const logger = new Logger('AnalyticsChatIntelligenceHelpers');

/**
 * Look up a pre-computed market briefing for the current geography context.
 * Also fetches any news articles published after the briefing was generated.
 * Returns null if no briefing exists or geography is not specified — the
 * existing tool-based flow continues unchanged in that case.
 */
export async function lookupBriefingContext(
  supabaseClient: SupabaseClient,
  briefingGenerator: BriefingGeneratorService,
  message: string,
  context?: Record<string, any>,
): Promise<{ briefing: MarketBriefing; freshNews: any[] } | null> {
  try {
    const geographyId = context?.geographyId || context?.geography_id;
    const geographyType = context?.geographyType || context?.geography_type;

    if (!geographyId) return null;

    const { data: briefing } = await supabaseClient
      .from('market_briefings')
      .select('*')
      .eq('geography_id', geographyId)
      .eq('is_latest', true)
      .single();

    if (!briefing) {
      // Fire-and-forget: generate a briefing for this market so it's ready
      // next time. The detached promise must NOT slow down the current request.
      const geoType = (geographyType === 'county' ? 'county' : 'metro') as 'metro' | 'county';
      briefingGenerator
        .generateBriefingOnDemand(geographyId, geoType, String(geographyId))
        .catch((err) =>
          logger.warn(`On-demand briefing trigger failed: ${err.message}`),
        );
      return null;
    }

    // Fetch any news published after the briefing was generated
    const { data: freshNews } = await supabaseClient
      .from('market_news')
      .select('headline, source_name, published_at, summary, sentiment')
      .contains('geography_ids', [geographyId])
      .gt('published_at', briefing.generated_date)
      .order('published_at', { ascending: false })
      .limit(5);

    return { briefing: briefing as MarketBriefing, freshNews: freshNews || [] };
  } catch (error: any) {
    logger.warn(`Briefing lookup failed: ${error.message}`);
    return null; // Fall through to tool-based flow
  }
}

/**
 * Check the rankings cache for a pre-computed answer to ranking-intent queries.
 * Matches simple "top N" / "bottom N" patterns against known metric keywords.
 * Returns a formatted context string or null if no cache hit.
 */
export async function lookupRankingsCache(
  appConfig: AppConfigService,
  rankingsCache: RankingsCacheService,
  message: string,
): Promise<string | null> {
  try {
    const enabled = await appConfig.getBool('RANKINGS_CACHE_ENABLED', false);
    if (!enabled) return null;

    // Simple keyword matching for ranking queries
    const rankingPatterns = [
      { pattern: /top\s+\d+.*(?:highest|best|most|hottest)/i, direction: 'top' as const },
      { pattern: /bottom\s+\d+.*(?:lowest|worst|least|cheapest)/i, direction: 'bottom' as const },
      { pattern: /(?:highest|best|most|hottest)\s+\d+/i, direction: 'top' as const },
      { pattern: /(?:lowest|worst|least|cheapest)\s+\d+/i, direction: 'bottom' as const },
    ];

    let direction: 'top' | 'bottom' | null = null;
    for (const { pattern, direction: dir } of rankingPatterns) {
      if (pattern.test(message)) {
        direction = dir;
        break;
      }
    }
    if (!direction) return null;

    // Try to match a metric from the message
    const metricKeywords: Record<string, string> = {
      'home value': 'home_value',
      'home price': 'home_value',
      'appreciation': 'appreciation_yoy',
      'rent': 'rent_index',
      'cap rate': 'cap_rate',
      'vacancy': 'vacancy_rate',
      'population growth': 'population_growth',
      'unemployment': 'unemployment_rate',
      'days on market': 'dom',
      'dom': 'dom',
      'inventory': 'inventory',
      'price to rent': 'price_to_rent',
      'income': 'median_income',
    };

    let metricId: string | null = null;
    const lowerMessage = message.toLowerCase();
    for (const [keyword, id] of Object.entries(metricKeywords)) {
      if (lowerMessage.includes(keyword)) {
        metricId = id;
        break;
      }
    }
    if (!metricId) return null;

    // Default to metro level
    const rankings = await rankingsCache.getRanking(metricId, 'metro', direction);
    if (!rankings || rankings.length === 0) return null;

    // Format as context string for prompt injection
    const formatted = rankings
      .map((r, i) => `${i + 1}. ${r.geography_name}: ${r.formatted}`)
      .join('\n');

    return `Pre-computed ${direction} 10 rankings for ${metricId} (metro level):\n${formatted}`;
  } catch (error: any) {
    logger.warn(`Rankings cache lookup failed: ${error.message}`);
    return null;
  }
}

/**
 * Format a MarketBriefing into a text block suitable for prompt injection.
 * Includes stance, signals, risk flags, key metrics, narrative, and fresh news.
 */
export function formatBriefingForPrompt(briefing: MarketBriefing, freshNews: any[]): string {
  const parts = [
    `\n=== MARKET INTELLIGENCE BRIEFING: ${briefing.geography_name} ===`,
    `Stance: ${briefing.market_stance}`,
    `Signals: ${briefing.stance_signals.map(s => `${s.signal} (${s.direction})`).join(', ')}`,
    `Risk Flags: ${briefing.risk_flags.length > 0 ? briefing.risk_flags.map(f => f.detail).join('; ') : 'None'}`,
    `\nKey Metrics:`,
  ];

  for (const [key, metric] of Object.entries(briefing.metrics_snapshot)) {
    if (metric.value != null) {
      parts.push(`  ${key}: ${metric.formatted}`);
    }
  }

  if (briefing.narrative_summary) {
    parts.push(`\nAnalyst Summary: ${briefing.narrative_summary}`);
  }

  if (freshNews.length > 0) {
    parts.push(`\nRecent News:`);
    freshNews.forEach(n => parts.push(`  - ${n.headline} (${n.source_name})`));
  }

  if (briefing.suggested_questions?.length > 0) {
    parts.push(`\nSuggested Follow-ups: ${briefing.suggested_questions.join(' | ')}`);
  }

  return parts.join('\n');
}
