/**
 * Quinn Chat Helpers
 *
 * Utility functions for parsing and transforming Quinn assistant responses,
 * including follow-up suggestion extraction and API response normalization.
 */

import type { QuinnStructuredData } from './QuinnStructuredData.types';

export interface StarterPrompt {
  text: string;
  icon: string;
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  { text: 'What are the hottest markets right now?', icon: 'trending_up' },
  { text: 'Compare Denver vs Austin for investing', icon: 'compare' },
  { text: 'Where should I invest for cash flow?', icon: 'payments' },
];

export interface ParsedResponse {
  cleanText: string;
  followUps: string[];
}

/**
 * Detects follow-up suggestions embedded in Quinn's response text and
 * separates them from the main content.
 *
 * Expected format at the end of a response:
 *   "You might also want to know: Question 1 | Question 2 | Question 3"
 *
 * Returns the clean response text (without the follow-up line) and an
 * array of follow-up question strings. If no pattern is found, followUps
 * is an empty array and cleanText is the original text unchanged.
 */
export function parseFollowUpSuggestions(text: string): ParsedResponse {
  const pattern = /You might also want to know:\s*(.+)$/im;
  const match = text.match(pattern);

  if (!match) return { cleanText: text, followUps: [] };

  const cleanText = text.replace(pattern, '').trim();
  const followUps = match[1]
    .split('|')
    .map((q) => q.trim())
    .filter((q) => q.length > 0);

  return { cleanText, followUps };
}

// ---------------------------------------------------------------------------
// API response parsing
// ---------------------------------------------------------------------------

export interface ParsedChatResponse {
  content: string;
  structuredData?: QuinnStructuredData;
  followUps: string[];
}

/**
 * Parses the raw JSON response from the Quinn chat API into a normalized
 * format suitable for rendering as an assistant message.
 *
 * Handles: text extraction, structured data detection, follow-up extraction,
 * and fallback content when the response text is empty.
 */
export function parseChatApiResponse(data: Record<string, unknown>): ParsedChatResponse {
  let content = typeof data.response === 'string' ? data.response.trim() : '';
  if (!content && data.message) {
    content = String(data.message).trim();
  }

  const structured = data.structuredData as QuinnStructuredData | undefined;
  const hasRichData = structured && (
    structured.rankings?.items?.length ||
    structured.comparison?.metrics?.length ||
    structured.chart?.data?.length ||
    structured.table?.rows?.length
  );

  // When rich data is present, show only the intro paragraph as text
  if (hasRichData) {
    const intro = content.split(/\n\n/)[0]?.trim();
    if (intro) content = intro;
  } else if (!content && structured?.rankings?.items?.length) {
    const direction = structured.rankings.direction === 'bottom' ? 'bottom' : 'top';
    content = `Here are the ${direction} markets.`;
  }

  if (!content) {
    content = 'I received your message but had trouble showing a response. Please try again.';
  }

  const { cleanText, followUps } = parseFollowUpSuggestions(content);

  const hasStructuredContent = structured && (
    structured.rankings || structured.comparison || structured.chart || structured.table
  );

  return {
    content: cleanText,
    structuredData: hasStructuredContent ? structured : undefined,
    followUps,
  };
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Maps a caught error into a user-friendly message based on common
 * failure patterns (network issues, timeouts, service unavailability).
 */
export function classifyErrorMessage(error: Error): string {
  const msg = error.message;

  if (msg.includes('fetch') || msg.includes('network')) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }
  if (msg.includes('timeout')) {
    return 'The request timed out. Please try again.';
  }
  if (msg.includes('503') || msg.includes('unavailable')) {
    return 'The AI service is temporarily unavailable. Please try again in a moment.';
  }

  return 'Sorry, I encountered an error. Please try again.';
}
