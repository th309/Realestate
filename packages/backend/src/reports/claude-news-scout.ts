/**
 * Claude News Scout - API-driven news scouting functions.
 *
 * Extracted from ClaudeNewsService to keep file sizes under 300 lines.
 * These are standalone functions that accept an Anthropic client and logger.
 */

import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { NationalContext, NewsScoutResult } from './claude-news.types';
import { parseResponse, stripCitations } from './claude-news-parser';
import {
  buildScoutPrompt,
  buildNationalContextPrompt,
} from './claude-news-prompts';

// Re-export prompt builders so existing consumers can import from one place
export { buildScoutPrompt, buildNationalContextPrompt };

// -----------------------------------------------------------------------------
// SCOUTING
// -----------------------------------------------------------------------------

/**
 * Scout news for a specific geography using Claude web search.
 */
export async function scoutNewsForGeography(
  client: Anthropic,
  model: string,
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
    const newsPromise = client.messages
      .create({
        model,
        max_tokens: 16384,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 3,
          },
        ],
        messages: [{ role: 'user', content: prompt }],
      })
      .catch((err) => {
        logger.warn(
          `Local news web search failed for ${geographyName}: ${err?.message || err}`,
        );
        return null;
      });

    const nationalPromise = includeNationalContext
      ? fetchNationalContext(client, model, logger).catch((err) => {
          logger.warn(`National context fetch failed: ${err?.message || err}`);
          return null;
        })
      : Promise.resolve(null);

    const [response, nationalContext] = await Promise.all([
      newsPromise,
      nationalPromise,
    ]);

    // Parse local news from web search response
    let parsed: any = {
      local_news: [],
      economic_indicators: [],
      market_signals: [],
    };

    if (response) {
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );

      logger.log(
        `News response for ${geographyName}: ${response.content.length} blocks, ${textBlocks.length} text, stop=${response.stop_reason}`,
      );

      if (response.stop_reason === 'max_tokens') {
        logger.warn(
          `News response TRUNCATED (max_tokens) for ${geographyName}. JSON may be incomplete.`,
        );
      }

      // Try each text block individually, last first
      for (let i = textBlocks.length - 1; i >= 0; i--) {
        const blockText = stripCitations(textBlocks[i].text);
        const result = parseResponse(blockText, logger);
        if (
          result.local_news?.length ||
          result.economic_indicators?.length ||
          result.market_signals?.length
        ) {
          logger.log(
            `Parsed news from text block ${i + 1}/${textBlocks.length} (${blockText.length} chars)`,
          );
          parsed = result;
          break;
        }
      }
      // Fallback: join all text blocks and try once more
      if (!parsed.local_news?.length && !parsed.market_signals?.length) {
        const allText = stripCitations(
          textBlocks.map((b) => b.text).join('\n'),
        );
        parsed = parseResponse(allText, logger);
      }
    } else {
      logger.warn(
        `Web search failed for ${geographyName} — returning national context only`,
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
        model_used: model,
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
    if (error?.status) {
      logger.error(
        `Anthropic API status: ${error.status}, type: ${error?.error?.type}`,
      );
    }
    return null;
  }
}

/**
 * Fetch national economic context using Claude web search.
 */
export async function fetchNationalContext(
  client: Anthropic,
  model: string,
  logger: Logger,
): Promise<NationalContext | null> {
  const prompt = buildNationalContextPrompt();

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 3,
        },
      ],
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    for (let i = textBlocks.length - 1; i >= 0; i--) {
      const result = parseResponse(stripCitations(textBlocks[i].text), logger);
      if (
        result.fed_rate_news ||
        result.mortgage_rate_trend ||
        result.national_housing_news?.length
      ) {
        return result;
      }
    }
    // Fallback: join all
    const allText = stripCitations(textBlocks.map((b) => b.text).join('\n'));
    return parseResponse(allText, logger);
  } catch (error: any) {
    logger.error(
      `Failed to fetch national context: ${error?.message || error}`,
      error?.stack,
    );
    return null;
  }
}
