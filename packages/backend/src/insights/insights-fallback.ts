/**
 * Insights Fallback Builder
 *
 * Deterministic, data-driven fallback used when AI generation is unavailable.
 * Follows the AI-prose rules: no markdown, no em-dashes, no code identifiers.
 */

export interface FallbackContext {
  region_name: string;
  score: number | null;
  grade: string | null;
  median_price: number | null;
  days_on_market: number | null;
  price_reduced_share: number | null; // fraction (0.18 = 18%)
  zhvi_yoy: number | null; // fraction
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export function buildFallbackInsightContent(
  ctx: FallbackContext,
  _insightType: string,
): string {
  const parts: string[] = [];

  if (ctx.score !== null) {
    const grade = ctx.grade ? ` and a confidence grade of ${ctx.grade}` : '';
    parts.push(
      `${ctx.region_name} has a PropertyIQ Score of ${Math.round(ctx.score)}${grade}. The score is computed across all markets at this geography level and calibrated so 50 represents the state average, which means a score above 50 points to stronger expected performance relative to the state.`,
    );
  } else {
    parts.push(
      `${ctx.region_name} does not have enough recent data for a PropertyIQ Score this period.`,
    );
  }

  if (ctx.median_price !== null) {
    const yoy =
      ctx.zhvi_yoy !== null
        ? ` Home values are ${ctx.zhvi_yoy >= 0 ? 'up' : 'down'} about ${Math.abs(ctx.zhvi_yoy * 100).toFixed(1)} percent over the past year.`
        : '';
    parts.push(
      `The median home value is around ${money(ctx.median_price)}.${yoy}`,
    );
  }

  if (ctx.days_on_market !== null) {
    parts.push(
      `Homes are taking about ${Math.round(ctx.days_on_market)} days to sell.`,
    );
  }

  if (ctx.price_reduced_share !== null) {
    parts.push(
      `Roughly ${Math.round(ctx.price_reduced_share * 100)} percent of listings have had a price cut, a signal of how much pricing pressure sellers face.`,
    );
  }

  return parts.join(' ');
}
