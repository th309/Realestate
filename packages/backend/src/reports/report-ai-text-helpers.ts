/**
 * Pure helper functions for AI narrative text processing.
 *
 * Extracted from report-ai.service.ts to keep file sizes under limits.
 * Handles template interpolation, JSON parsing, text sanitization,
 * and fallback narratives.
 */

import { Logger } from '@nestjs/common';

/**
 * Replace {{placeholder}} tokens in a template with context values.
 */
export function interpolateTemplate(
  template: string,
  context: Record<string, any>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = context[key];
    if (value === undefined || value === null) return match;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Parse a JSON response from the AI, handling code fences and truncation.
 */
export function parseJsonResponse(
  raw: string,
  sectionId: string,
  logger: Logger,
): any {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    if (cleaned.startsWith('[')) {
      try {
        const lastObj = cleaned.lastIndexOf('}');
        if (lastObj > 0) {
          const truncated = cleaned.substring(0, lastObj + 1) + ']';
          const parsed = JSON.parse(truncated);
          if (Array.isArray(parsed) && parsed.length > 0) {
            logger.warn(
              `Recovered ${parsed.length} items from truncated JSON for ${sectionId}`,
            );
            return parsed;
          }
        }
      } catch {
        // Recovery also failed
      }
    }
    logger.warn(`Failed to parse JSON for ${sectionId}, storing as raw string`);
    return raw;
  }
}

/**
 * Clean AI text output for report display:
 * - Strip markdown formatting (headers, bold, italic, code fences)
 * - Replace emdashes with regular dashes
 * - Normalize smart quotes to plain quotes
 */
export function sanitizeNarrativeText(text: string): string {
  return text
    .replace(/^```(?:\w+)?\s*\n?/gim, '') // opening code fences
    .replace(/\n?```\s*$/gim, '') // closing code fences
    .replace(/^#{1,6}\s+/gm, '') // markdown headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold **text**
    .replace(/\*([^*]+)\*/g, '$1') // italic *text*
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/\u2014/g, ' - ') // emdash to spaced dash
    .replace(/\u2013/g, '-') // endash to dash
    .replace(/\u2018|\u2019/g, "'") // smart single quotes
    .replace(/\u201C|\u201D/g, '"') // smart double quotes
    .trim();
}

/**
 * Retry an async function with exponential backoff.
 *
 * Retries on any error up to maxRetries times. Waits 1s, 2s, 4s between
 * attempts (exponential backoff with jitter). Logs each retry attempt.
 *
 * @param fn - Async function to retry
 * @param label - Human-readable label for log messages (e.g., section ID)
 * @param logger - Logger instance
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns The result of fn() on success
 * @throws The last error if all retries are exhausted
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  label: string,
  logger: Logger,
  maxRetries = 3,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Non-retryable errors (e.g. the spend-cap circuit-breaker) can't recover
      // this run — fail fast instead of burning attempts and backoff delays.
      if (error?.retryable === false) {
        throw error;
      }
      if (attempt < maxRetries) {
        const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        const jitter = Math.random() * 500; // 0-500ms jitter
        const delay = baseDelay + jitter;
        logger.warn(
          `[retry] ${label} attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}. Retrying in ${Math.round(delay)}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(
    `[retry] ${label} failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
  );
  throw lastError;
}

/**
 * Return a safe fallback string when AI generation fails.
 */
export function getFallbackNarrative(sectionId: string): string {
  const fallbacks: Record<string, string> = {
    market_summary:
      'Market analysis is being processed. Please check back shortly.',
    trend_observations: 'Trend analysis is being compiled from market data.',
    investment_assessment: 'Investment potential is being calculated.',
    affordability_analysis: 'Affordability metrics are being processed.',
  };
  return (
    fallbacks[sectionId] ||
    'Analysis pending. Please refresh to see updated insights.'
  );
}
