/**
 * Quinn Chat Helpers
 *
 * Utility functions for parsing and transforming Quinn assistant responses,
 * including follow-up suggestion extraction.
 */

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
