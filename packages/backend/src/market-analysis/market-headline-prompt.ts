import { getScoreMomentumLabel } from '../scoring/score-label.util';

export interface HeadlineRequest {
  geoType: string;
  geoId: string;
  geoName: string;
  audience: 'homebuyer' | 'investor';
  metrics: Record<
    string,
    { value: number | null; formatted: string; change: number | null }
  >;
  scores: { propertyiq: { score: number; grade: string } };
}

export interface HeadlineContent {
  headline: string;
  summary: string;
}

// Restated verbatim from src/insights/insight-prompts.ts so the headline prompt
// carries the same guarantees the report/insight narratives already rely on.
const DATA_GROUNDING_RULE =
  'Use ONLY the data provided below. Do not fabricate or assume any numbers. If data is missing, say so.';
const PLAIN_PROSE_RULE =
  'Write plain prose only: no markdown or formatting (no bold, italics, headers, bullets, or backticks), no em-dashes (use a comma, period, or "and"), and no code-style identifiers (write field names in plain English). Keep all numbers exact.';

/**
 * CLAUDE.md §9 momentum labels. Delegates to the canonical backend SSOT
 * (`getScoreMomentumLabel`) so the ladder can't drift from the rest of the
 * backend — momentum/timing words only, never a quality verdict.
 */
export function scoreMomentumWord(score: number): string {
  return getScoreMomentumLabel(score);
}

export function buildHeadlinePrompt(request: HeadlineRequest): string {
  const { geoName, metrics, scores, audience } = request;

  const metricsBlock = Object.entries(metrics)
    .filter(([, v]) => v.value != null)
    .map(([key, v]) => {
      const changePart =
        v.change != null
          ? ` (${v.change >= 0 ? '+' : ''}${v.change.toFixed(1)}% YoY)`
          : '';
      return `- ${key.replace(/_/g, ' ')}: ${v.formatted}${changePart}`;
    })
    .join('\n');

  const momentum = scoreMomentumWord(scores.propertyiq.score);

  return `You are a sharp, experienced real estate market analyst. Write a SHORT framing for ${geoName} for a ${audience} audience.

Market Data for ${geoName}:
${metricsBlock}

PropertyIQ Score: ${scores.propertyiq.score}/100 (momentum reads ${momentum}; 50 = the market's state average, higher = stronger demand momentum).

Write exactly two things:
1. "headline": a punchy framing of no more than 8 words. Describe the market's momentum or direction, never a quality verdict. Good: "Prices firming, buyers still have room". Bad: "Great market" or "Poor market".
2. "summary": two to three sentences, 40 to 60 words total. Reference two or three specific numbers from the data above. Speak to the ${audience}. End with one plain, practical takeaway sentence.

${DATA_GROUNDING_RULE}
${PLAIN_PROSE_RULE}
The PropertyIQ Score is a momentum and timing signal, not a quality grade. Use momentum words (rising, firming, steady, easing, cooling), never quality words (good, bad, excellent, poor).

Respond in this exact JSON format:
{"headline":"...","summary":"..."}`;
}

export function buildHeadlineFallback(
  request: HeadlineRequest,
): HeadlineContent {
  const { geoName, scores, metrics } = request;
  const momentum = scoreMomentumWord(scores.propertyiq.score).toLowerCase();

  const parts: string[] = [
    `${geoName} is showing ${momentum} demand momentum with a PropertyIQ Score of ${scores.propertyiq.score}.`,
  ];

  const homeValue = metrics.home_value;
  if (homeValue?.value != null) {
    const yoyPart =
      homeValue.change != null
        ? `, ${homeValue.change >= 0 ? 'up' : 'down'} ${Math.abs(homeValue.change).toFixed(1)}% year over year`
        : '';
    parts.push(
      `The typical home is valued around ${homeValue.formatted}${yoyPart}.`,
    );
  }

  parts.push('Review the metrics below to see where this market is heading.');

  return {
    headline: `${geoName}: ${momentum} momentum`,
    summary: parts.join(' '),
  };
}
