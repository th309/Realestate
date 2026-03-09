/**
 * News Scout - API-driven news scouting functions.
 *
 * Uses AiProviderService (provider-agnostic) to generate market news
 * and economic context. Any configured AI provider can be used.
 */

import { Logger } from '@nestjs/common';
import type { AiProviderService } from '../ai-provider/ai-provider.service';
import type { NationalContext, NewsScoutResult } from './news-scout.types';
import { parseResponse } from './news-scout-parser';
import {
  buildScoutPrompt,
  buildNationalContextPrompt,
} from './news-scout-prompts';

// Re-export prompt builders so existing consumers can import from one place
export { buildScoutPrompt, buildNationalContextPrompt };

const NEWS_SCOUT_PURPOSE = 'news_scout';

// -----------------------------------------------------------------------------
// SCOUTING
// -----------------------------------------------------------------------------

/**
 * Scout news for a specific geography using the configured AI provider.
 */
export async function scoutNewsForGeography(
  aiProvider: AiProviderService,
  logger: Logger,
  geographyId: string,
  geographyType: 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip',
  geographyName: string,
  state: string,
  options: {
    includeNationalContext?: boolean;
    maxNewsItems?: number;
    lookbackDays?: number;
  } = {},
): Promise<NewsScoutResult | null> {
  const startTime = Date.now();
  const {
    includeNationalContext = true,
    maxNewsItems = 10,
    lookbackDays = 90,
  } = options;

  const prompt = buildScoutPrompt(
    geographyName,
    state,
    geographyType,
    lookbackDays,
    maxNewsItems,
  );

  try {
    // Run local news scouting and national context in parallel.
    const newsPromise = aiProvider
      .complete(NEWS_SCOUT_PURPOSE, {
        userPrompt: prompt,
        maxTokens: 4096,
        responseFormat: 'json',
      })
      .catch((err) => {
        logger.warn(
          `News scout failed for ${geographyName}: ${err?.message || err}`,
        );
        return null;
      });

    const nationalPromise = includeNationalContext
      ? fetchNationalContext(aiProvider, logger).catch((err) => {
          logger.warn(`National context fetch failed: ${err?.message || err}`);
          return null;
        })
      : Promise.resolve(null);

    const [response, nationalContext] = await Promise.all([
      newsPromise,
      nationalPromise,
    ]);

    // Parse local news from response
    let parsed: any = {
      local_news: [],
      economic_indicators: [],
      market_signals: [],
    };

    if (response) {
      parsed = parseResponse(response.content, logger);

      logger.log(
        `News response for ${geographyName}: ${response.provider}/${response.model}, ${response.durationMs}ms`,
      );
    } else {
      logger.warn(
        `News scout failed for ${geographyName} — returning national context only`,
      );
    }

    if (
      !parsed.local_news?.length &&
      !parsed.economic_indicators?.length &&
      !parsed.market_signals?.length &&
      !nationalContext
    ) {
      logger.warn(`No news data AND no national context for ${geographyName}.`);
    }

    const processingTime = Date.now() - startTime;

    return {
      geography_id: geographyId,
      geography_type: geographyType,
      geography_name: geographyName,
      state,
      local_news: parsed.local_news || [],
      economic_indicators: parsed.economic_indicators || [],
      market_signals: parsed.market_signals || [],
      national_context: nationalContext,
      scout_metadata: {
        search_timestamp: new Date().toISOString(),
        model_used: response?.model || 'unknown',
        search_queries_used: [],
        total_sources_found:
          (parsed.local_news?.length || 0) +
          (parsed.economic_indicators?.length || 0) +
          (parsed.market_signals?.length || 0),
        processing_time_ms: processingTime,
      },
    };
  } catch (error: any) {
    logger.error(
      `Failed to scout news for ${geographyName}: ${error?.message || error}`,
      error?.stack,
    );
    return null;
  }
}

/**
 * Fetch national economic context using the configured AI provider.
 */
export async function fetchNationalContext(
  aiProvider: AiProviderService,
  logger: Logger,
): Promise<NationalContext | null> {
  const prompt = buildNationalContextPrompt();

  try {
    const response = await aiProvider.complete(NEWS_SCOUT_PURPOSE, {
      userPrompt: prompt,
      maxTokens: 1024,
      responseFormat: 'json',
    });

    const parsed = parseResponse(response.content, logger);
    if (
      parsed.fed_rate_news ||
      parsed.mortgage_rate_trend ||
      parsed.national_housing_news?.length
    ) {
      return parsed;
    }

    return parsed;
  } catch (error: any) {
    logger.error(
      `Failed to fetch national context: ${error?.message || error}`,
      error?.stack,
    );
    return null;
  }
}
