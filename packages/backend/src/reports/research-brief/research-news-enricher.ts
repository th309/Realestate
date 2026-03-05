/**
 * Research News Enricher
 *
 * Enriches research data with direct news fetching, using the same
 * pattern as HomeReady/InvestorEdge reports (ClaudeNewsService.getOrScoutNews
 * + formatNewsForPrompt). This does NOT rely on the agent's search_news
 * tool call — it guarantees news context in the research data.
 *
 * Extracted from ResearchBriefService to stay under file size limits.
 */

import { Logger } from '@nestjs/common';
import { ClaudeNewsService } from '../claude-news.service';

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
  newsService: ClaudeNewsService | null,
): Promise<Record<string, unknown>> {
  if (!newsService) return researchData;

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
