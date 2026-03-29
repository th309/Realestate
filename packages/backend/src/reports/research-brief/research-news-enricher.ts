/**
 * Research News Enricher
 *
 * Enriches research data with direct news fetching, using the same
 * pattern as PropertyIQ reports (NewsScoutService.getOrScoutNews
 * + formatNewsForPrompt). This does NOT rely on the agent's search_news
 * tool call — it guarantees news context in the research data.
 *
 * Extracted from ResearchBriefService to stay under file size limits.
 */

import { Logger } from '@nestjs/common';
import { NewsScoutService } from '../news-scout.service';

const logger = new Logger('ResearchNewsEnricher');

/**
 * Extract all region names from research data for news lookup.
 */
export function extractAllRegionNames(data: Record<string, unknown>): string[] {
  try {
    const regions = data.regions_analyzed as string[] | undefined;
    if (regions?.length) return regions;
  } catch {
    /* best-effort */
  }
  return [];
}

/**
 * Enrich research data with direct news fetch.
 * Fetches local news, economic indicators, market signals, and national
 * context for the top analyzed region, then formats it as a readable
 * string injected into the research data as `news_context`.
 */
export async function enrichResearchWithNews(
  researchData: Record<string, unknown>,
  newsService: NewsScoutService | null,
): Promise<Record<string, unknown>> {
  if (!newsService) return researchData;

  // Skip if the agent already collected news via search_news tool calls
  const hasNews =
    (researchData as any).news_context ||
    (researchData as any).forced_news?.length > 0;
  if (hasNews) {
    logger.log('Skipping direct news fetch — agent already collected news');
    return researchData;
  }

  const regionNames = extractAllRegionNames(researchData);
  const topRegion = regionNames[0];
  if (!topRegion) return researchData;

  try {
    logger.log(`Direct news fetch for: ${topRegion}`);
    const newsResult = await newsService.getOrScoutNews(
      topRegion.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      'metro',
      topRegion,
      '',
      { includeNationalContext: true, maxNewsItems: 10, lookbackDays: 90 },
    );

    if (newsResult) {
      (researchData as any).news_context = newsService.formatNewsForPrompt(
        newsResult,
        {
          maxNewsItems: 5,
          includeIndicators: true,
          includeSignals: true,
          includeNational: true,
        },
      );
    }
  } catch (err: any) {
    logger.warn(`Direct news fetch failed: ${err.message}`);
  }

  return researchData;
}
