/**
 * Claude News Formatting Utilities
 *
 * Pure functions for summarizing and formatting news results
 * for use in prompts and display. No service dependencies.
 */

import type { NewsScoutResult, SignalSummary } from './claude-news.types';

/**
 * Summarize market signals from a news result.
 */
export function summarizeSignals(result: NewsScoutResult): SignalSummary {
  const signals = result.market_signals;
  const bullish = signals.filter((s) => s.signal_type === 'bullish');
  const bearish = signals.filter((s) => s.signal_type === 'bearish');
  const neutral = signals.filter((s) => s.signal_type === 'neutral');

  let overall: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  if (bullish.length > bearish.length + 1) {
    overall = 'bullish';
  } else if (bearish.length > bullish.length + 1) {
    overall = 'bearish';
  } else if (bullish.length === 0 && bearish.length === 0) {
    overall = 'neutral';
  } else {
    overall = 'mixed';
  }

  return {
    overall,
    bullish_count: bullish.length,
    bearish_count: bearish.length,
    neutral_count: neutral.length,
    high_confidence_signals: signals.filter((s) => s.confidence === 'high'),
  };
}

/**
 * Format news result for inclusion in a Claude prompt context.
 */
export function formatNewsForPrompt(
  result: NewsScoutResult,
  options: {
    maxNewsItems?: number;
    includeIndicators?: boolean;
    includeSignals?: boolean;
    includeNational?: boolean;
  } = {},
): string {
  const {
    maxNewsItems = 5,
    includeIndicators = true,
    includeSignals = true,
    includeNational = true,
  } = options;

  const parts: string[] = [];

  // Local news
  const news = result.local_news
    .filter((n) => n.relevance !== 'low')
    .slice(0, maxNewsItems);

  if (news.length > 0) {
    parts.push('## RECENT LOCAL NEWS\n');
    news.forEach((item) => {
      parts.push(
        `**${item.headline}** (${item.source}, ${item.published_date})`,
      );
      parts.push(`${item.summary}`);
      parts.push(`Impact: ${item.impact_on_real_estate}`);
      parts.push(`Sentiment: ${item.sentiment} | Category: ${item.category}\n`);
    });
  }

  // Economic indicators
  if (includeIndicators && result.economic_indicators.length > 0) {
    parts.push('\n## ECONOMIC INDICATORS\n');
    result.economic_indicators.forEach((ind) => {
      parts.push(
        `**${ind.indicator_name}** (${ind.geography_level}): ${ind.current_value}`,
      );
      parts.push(`${ind.change_description}`);
      parts.push(
        `Housing impact: ${ind.impact_on_housing} - ${ind.impact_explanation}\n`,
      );
    });
  }

  // Market signals
  if (includeSignals && result.market_signals.length > 0) {
    const summary = summarizeSignals(result);
    parts.push(
      `\n## MARKET SIGNALS (Overall: ${summary.overall.toUpperCase()})\n`,
    );
    result.market_signals.forEach((signal) => {
      const emoji =
        signal.signal_type === 'bullish'
          ? '📈'
          : signal.signal_type === 'bearish'
            ? '📉'
            : '➡️';
      parts.push(`${emoji} **${signal.headline}**`);
      parts.push(`${signal.description}`);
      parts.push(`Confidence: ${signal.confidence}\n`);
    });
  }

  // National context
  if (includeNational && result.national_context) {
    const nat = result.national_context;
    parts.push('\n## NATIONAL CONTEXT\n');
    if (nat.fed_rate_news) {
      parts.push(`**Fed Policy:** ${nat.fed_rate_news}`);
    }
    if (nat.mortgage_rate_trend) {
      parts.push(`**Mortgage Rates:** ${nat.mortgage_rate_trend}`);
    }
    if (nat.economic_outlook) {
      parts.push(`**Economic Outlook:** ${nat.economic_outlook}`);
    }
  }

  return parts.join('\n');
}
