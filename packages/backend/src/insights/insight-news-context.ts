/**
 * Insight News Context
 *
 * Fetches + formats recent local real-estate/economic news for the
 * market_outlook prompt via the Gemini-backed news scout. Extracted from
 * InsightsService to keep file sizes under the 300-line limit.
 */

import { Logger } from '@nestjs/common';
import { NewsScoutService } from '../reports/news-scout.service';
import { InsightContext } from './insights.types';

const logger = new Logger('InsightNewsContext');

/**
 * Fetch + format recent local real-estate/economic news for the prompt via the
 * Gemini-backed news scout. 90-day lookback to match the Score's 3-month
 * momentum window. The scout caches results 24h in report_news_cache.
 */
export async function buildNewsContext(
  context: InsightContext,
  newsScout: NewsScoutService,
): Promise<string> {
  try {
    const [name, state] = context.region_name.split(',').map((s) => s.trim());
    const result = await newsScout.getOrScoutNews(
      context.region_id,
      context.geo_level,
      name || context.region_name,
      state || '',
      { maxNewsItems: 6, lookbackDays: 90, includeNationalContext: false },
    );
    if (!result) return '';
    return newsScout.formatNewsForPrompt(result, {
      maxNewsItems: 6,
      includeIndicators: true,
      includeSignals: true,
      includeNational: false,
    });
  } catch (err) {
    logger.warn(
      `News scout failed for ${context.region_id}: ${(err as Error).message}`,
    );
    return '';
  }
}
