/**
 * Gemini News Scout — response parsing (pure)
 *
 * Extracted from gemini-news.service.ts for file-size compliance.
 */

/**
 * Parse JSON from Gemini response
 */
export function parseGeminiResponse(text: string): any {
  // Try markdown code block
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {}
  }

  // Try raw JSON
  try {
    return JSON.parse(text);
  } catch {}

  // Try to find JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {}
  }

  return { local_news: [], economic_indicators: [], market_signals: [] };
}
