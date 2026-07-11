/**
 * Market Forecast prompt builder for /forecast SEO pages.
 *
 * Separated from insight-prompts.ts to comply with 300-line file limit.
 * Uses reusable formatting helpers and data-grounding rules from the main module.
 */

import { InsightContext } from './insights.types';
import {
  DATA_GROUNDING_RULE,
  formatBenchmarks,
  formatKeyMetrics,
  formatTopComponents,
} from './insight-prompts';

/** Hard honesty constraint for forecast-angle content (SEO /forecast pages). */
export const FORECAST_HONESTY_RULE =
  'This is a momentum outlook, not a price prediction. Never state or imply a specific future price, percentage change, or price target. Never predict a crash or a boom. Answer the crash question only by describing what the current momentum data shows and does not show. Where the data is mixed or missing, say so plainly.';

/**
 * Market Forecast — momentum-based forward outlook for the /forecast SEO pages.
 * Answers the "will home prices crash" question with momentum data only.
 * Uses markdown headers (##) for page-section delineation, like market_overview.
 */
export function buildMarketForecastPrompt(
  ctx: InsightContext,
  displayYear: number,
): string {
  const topComponents = formatTopComponents(ctx.score_components, 5);
  const confidence = ctx.scores.confidence_level ?? 'not available';

  return `You are a real estate analyst writing a forward-looking market outlook for ${displayYear}.

Data for ${ctx.region_name}:
- PropertyIQ Score: ${ctx.scores.propertyiq ?? 'N/A'}/100 (a demand-momentum signal; 50 equals the market's state average)
- Confidence: ${confidence}
- Top score drivers: ${topComponents}
- Key metrics: ${formatKeyMetrics(ctx.key_metrics)}
- Benchmarks:
${formatBenchmarks(ctx.benchmarks)}

Rules:
- Write 500-800 words total
- Use these exact markdown section headers in order:
  ## Will ${ctx.region_name} Home Prices Crash in ${displayYear}?
  ## Momentum Signals
  ## How ${ctx.region_name} Compares
  ## The Bottom Line for ${displayYear}
- "Will ... Crash": answer the crash question directly and honestly using ONLY the momentum data provided — describe what the data shows and what it does not show
- "Momentum Signals": interpret the score drivers (price momentum, days on market, price cuts) and what each signals for the year ahead
- "How ... Compares": compare the market against the state and national benchmarks provided
- "The Bottom Line for ${displayYear}": a grounded summary of the momentum outlook that names the confidence grade
- ${FORECAST_HONESTY_RULE}
- ${DATA_GROUNDING_RULE}
- Describe momentum with words like rising, firming, steady, easing, or cooling — never quality verdicts like good, bad, excellent, or poor
- Do NOT use bullet points — write in flowing paragraphs
- Do NOT use em-dashes
- Do NOT include a title or introduction before the first ## header`;
}
