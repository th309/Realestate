/**
 * Gemini News Scout — Gemini API calls (I/O)
 *
 * Extracted from gemini-news.service.ts for file-size compliance.
 * Dependencies (API key, model, logger) are passed explicitly instead of `this`.
 * Prompt/response string content is preserved exactly.
 */

import { Logger } from '@nestjs/common';
import type { NationalContext, NewsScoutResult } from './gemini-news.types';
import { buildScoutPrompt } from './gemini-news-prompt.helper';
import { parseGeminiResponse } from './gemini-news-parser.helper';

export interface GeminiNewsApiDeps {
  geminiApiKey: string | null;
  geminiModel: string;
  logger: Logger;
}

/**
 * Scout news for a specific geography
 */
export async function scoutNewsForGeography(
  deps: GeminiNewsApiDeps,
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
  const { geminiApiKey, geminiModel, logger } = deps;
  if (!geminiApiKey) return null;

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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.3,
          },
          tools: [{ googleSearch: {} }],
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = parseGeminiResponse(text);

    // Fetch national context separately if requested
    let nationalContext: NationalContext | null = null;
    if (includeNationalContext) {
      nationalContext = await fetchNationalContext(deps);
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
        model_used: geminiModel,
        search_queries_used: [],
        total_sources_found:
          (parsed.local_news?.length || 0) +
          (parsed.economic_indicators?.length || 0) +
          (parsed.market_signals?.length || 0),
        processing_time_ms: processingTime,
      },
    };
  } catch (error) {
    logger.error(`Failed to scout news for ${geographyName}:`, error);
    return null;
  }
}

/**
 * Fetch national economic context
 */
export async function fetchNationalContext(
  deps: GeminiNewsApiDeps,
): Promise<NationalContext | null> {
  const { geminiApiKey, geminiModel, logger } = deps;
  if (!geminiApiKey) return null;

  const prompt = `Search for the most recent national economic and housing news affecting US real estate:

1. Federal Reserve interest rate decisions or commentary (last 30 days)
2. Current mortgage rate trends
3. National housing market news (inventory, prices, sales)
4. Overall economic outlook

Return as JSON:
{
  "fed_rate_news": "Summary of most recent Fed decision or commentary",
  "mortgage_rate_trend": "Current 30-year rate and recent trend",
  "national_housing_news": ["2-3 relevant national headlines"],
  "economic_outlook": "1-2 sentence summary"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
          tools: [{ googleSearch: {} }],
        }),
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseGeminiResponse(text);
  } catch (error) {
    logger.error('Failed to fetch national context:', error);
    return null;
  }
}
