import { getScoreLabel } from "@/app/components/scoring/ScoreDisplay";

export interface HeadlineSummary {
  headline: string;
  summary: string;
}

/**
 * Deterministic, no-AI framing for the market headline. Shown to users without
 * the ai_insights entitlement, and as the client-side fallback if the AI call
 * fails. Uses getScoreLabel (canonical §9 momentum label) so the wording stays
 * in lockstep with the score components — momentum words only, never a quality
 * verdict.
 */
export function buildHeadlineSummary(
  marketName: string,
  score: number | null,
  cards: Record<
    string,
    {
      formattedValue: string;
      percentChange: number | null;
      value: number | null;
    }
  >,
): HeadlineSummary {
  if (score == null) {
    return {
      headline: `${marketName} market overview`,
      summary: `Live market metrics for ${marketName} are below. Pick a metric on the right to chart how it has moved over time.`,
    };
  }

  const momentum = getScoreLabel(score).toLowerCase();
  const parts: string[] = [
    `${marketName} is showing ${momentum} demand momentum with a PropertyIQ Score of ${Math.round(score)}.`,
  ];

  const homeValue = cards.home_value;
  if (homeValue && homeValue.value != null) {
    const yoy = homeValue.percentChange;
    const yoyPart =
      yoy != null
        ? `, ${yoy >= 0 ? "up" : "down"} ${Math.abs(yoy).toFixed(1)}% year over year`
        : "";
    parts.push(
      `The typical home is valued around ${homeValue.formattedValue}${yoyPart}.`,
    );
  }

  parts.push("Pick a metric on the right to chart its trend.");

  return {
    headline: `${marketName}: ${momentum} momentum`,
    summary: parts.join(" "),
  };
}
