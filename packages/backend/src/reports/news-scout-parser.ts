/**
 * Claude News Response Parser
 *
 * Handles parsing JSON from Claude API responses, including:
 * - Code-fenced JSON extraction
 * - Raw JSON parsing
 * - Key-search with string-aware brace matching
 */

import { Logger } from '@nestjs/common';

// -----------------------------------------------------------------------------
// BRACE MATCHING
// -----------------------------------------------------------------------------

/**
 * Find the matching closing brace for an opening brace, skipping braces
 * inside JSON strings. Returns the index of the closing brace, or -1.
 */
export function findMatchingBrace(text: string, openIndex: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

// -----------------------------------------------------------------------------
// RESPONSE PARSING
// -----------------------------------------------------------------------------

/**
 * Parse JSON from Claude response text.
 * Handles: code-fenced JSON, raw JSON, and JSON embedded in conversational text.
 */
export function parseResponse(text: string, logger: Logger): any {
  const empty = {
    local_news: [],
    economic_indicators: [],
    market_signals: [],
  };
  if (!text || text.trim().length === 0) return empty;

  // Strategy 1: markdown code block
  const jsonMatches = [
    ...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/g),
  ];
  for (const match of jsonMatches) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed === 'object') {
        logger.log(`parseResponse: parsed from code fence`);
        return parsed;
      }
    } catch {}
  }

  // Strategy 2: raw JSON (entire text is JSON)
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}

  // Strategy 3: Find JSON starting with { and containing our expected keys.
  const keyPatterns = [
    '"local_news"',
    '"economic_indicators"',
    '"market_signals"',
    '"fed_rate_news"',
    '"mortgage_rate_trend"',
    '"national_housing_news"',
  ];
  for (const keyPattern of keyPatterns) {
    const keyIdx = text.indexOf(keyPattern);
    if (keyIdx < 0) continue;

    // Walk backwards from the key to find the opening {
    let openBrace = -1;
    for (let i = keyIdx - 1; i >= 0; i--) {
      if (text[i] === '{') {
        openBrace = i;
        break;
      }
      if (text[i] === '\n' && i < keyIdx - 5) {
        const between = text.substring(i, keyIdx).trim();
        if (between && !between.startsWith('{') && between !== '') continue;
      }
    }
    if (openBrace < 0) continue;

    // String-aware brace matching from openBrace
    const closeBrace = findMatchingBrace(text, openBrace);
    if (closeBrace < 0) continue;

    const candidate = text.substring(openBrace, closeBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        logger.log(
          `parseResponse: parsed via key-search (key=${keyPattern}, length=${candidate.length})`,
        );
        return parsed;
      }
    } catch (e: any) {
      logger.warn(
        `parseResponse: key-search candidate failed: ${e.message?.substring(0, 80)}`,
      );
    }
  }

  logger.warn(
    `Could not parse JSON from response (${text.length} chars). First 300 chars: ${text.substring(0, 300)}`,
  );
  return empty;
}

/** Strip <cite> tags from web search responses. */
export const stripCitations = (text: string) =>
  text.replace(/<cite[^>]*>/g, '').replace(/<\/cite>/g, '');
