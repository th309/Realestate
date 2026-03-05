/**
 * Prompt templates for AI-generated market insights.
 *
 * Each function takes an InsightContext and returns a fully-formed prompt
 * string. All prompts include a strict data-grounding instruction to
 * prevent the model from fabricating numbers.
 */

import { InsightContext } from './insights.types';

const DATA_GROUNDING_RULE =
  'Use ONLY the data provided below. Do not fabricate or assume any numbers. If data is missing, say so.';

/**
 * Format score components sorted by value descending, returning
 * the top N entries as a human-readable string.
 */
function formatTopComponents(
  components: InsightContext['score_components'],
  limit: number,
): string {
  return Object.entries(components)
    .sort(([, a], [, b]) => b.value - a.value)
    .slice(0, limit)
    .map(([name, { status, value }]) => `${name}: ${status} (${value})`)
    .join(', ');
}

/**
 * Format key metrics as a compact single-line list.
 */
function formatKeyMetrics(metrics: InsightContext['key_metrics']): string {
  return Object.entries(metrics)
    .map(([name, { value }]) => `${name}: ${value ?? 'N/A'}`)
    .join(', ');
}

/**
 * Format benchmark comparisons when data is available.
 */
function formatBenchmarks(benchmarks: InsightContext['benchmarks']): string {
  const parts: string[] = [];

  const stateEntries = Object.entries(benchmarks.state_avg);
  if (stateEntries.length > 0) {
    parts.push(
      `State averages: ${stateEntries.map(([k, v]) => `${k}: ${v}`).join(', ')}`,
    );
  }

  const nationalEntries = Object.entries(benchmarks.national_avg);
  if (nationalEntries.length > 0) {
    parts.push(
      `National averages: ${nationalEntries.map(([k, v]) => `${k}: ${v}`).join(', ')}`,
    );
  }

  return parts.length > 0 ? parts.join('\n') : 'Benchmark data not available.';
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * Market Take — 2 sentences referencing the score, top driver, and a
 * benchmark comparison.
 */
export function buildMarketTakePrompt(ctx: InsightContext): string {
  const topComponents = formatTopComponents(ctx.score_components, 2);

  return `You are a real estate analyst writing a brief market insight.

Data for ${ctx.region_name}:
- HomeReady Score: ${ctx.scores.homeready ?? 'N/A'}/100
- InvestorEdge Score: ${ctx.scores.investoredge ?? 'N/A'}/100
- Market Health: ${ctx.scores.market_health ?? 'N/A'}/100
- Top score drivers: ${topComponents}
- Key metrics: ${formatKeyMetrics(ctx.key_metrics)}
- Benchmarks:
${formatBenchmarks(ctx.benchmarks)}

Rules:
- Write exactly 2 sentences
- Reference the score and at least one specific driver
- Compare to a benchmark if data is available
- ${DATA_GROUNDING_RULE}
- Be conversational but data-grounded`;
}

/**
 * Score Explanation — 1 sentence referencing the top 2 score components
 * and their status.
 */
export function buildScoreExplanationPrompt(ctx: InsightContext): string {
  const topComponents = formatTopComponents(ctx.score_components, 2);

  return `You are a real estate analyst explaining a market score in one sentence.

Data for ${ctx.region_name}:
- HomeReady Score: ${ctx.scores.homeready ?? 'N/A'}/100
- InvestorEdge Score: ${ctx.scores.investoredge ?? 'N/A'}/100
- Market Health: ${ctx.scores.market_health ?? 'N/A'}/100
- Top 2 score components: ${topComponents}

Rules:
- Write exactly 1 sentence
- Reference the top 2 components and their status
- ${DATA_GROUNDING_RULE}
- Be concise and informative`;
}

/**
 * Trend Interpretation — 1-2 sentences interpreting a metric's value
 * against state and national averages.
 */
export function buildTrendInterpretationPrompt(ctx: InsightContext): string {
  return `You are a real estate analyst interpreting market trends.

Data for ${ctx.region_name}:
- Key metrics: ${formatKeyMetrics(ctx.key_metrics)}
- Benchmarks:
${formatBenchmarks(ctx.benchmarks)}

Rules:
- Write 1-2 sentences
- Interpret the metric values compared to state and national averages
- Highlight whether the market is above or below benchmarks and what that implies
- ${DATA_GROUNDING_RULE}
- Be conversational but data-grounded`;
}

/**
 * Market Overview — 3-4 sentence paragraph for landing pages, covering
 * scores, key metrics, and overall market positioning.
 */
export function buildMarketOverviewPrompt(ctx: InsightContext): string {
  const topComponents = formatTopComponents(ctx.score_components, 3);

  return `You are a real estate analyst writing a market overview paragraph for a landing page.

Data for ${ctx.region_name}:
- HomeReady Score: ${ctx.scores.homeready ?? 'N/A'}/100
- InvestorEdge Score: ${ctx.scores.investoredge ?? 'N/A'}/100
- Market Health: ${ctx.scores.market_health ?? 'N/A'}/100
- Top score drivers: ${topComponents}
- Key metrics: ${formatKeyMetrics(ctx.key_metrics)}
- Benchmarks:
${formatBenchmarks(ctx.benchmarks)}

Rules:
- Write 3-4 sentences
- Open with the overall market positioning (strong, moderate, weak)
- Mention the most important score and its key driver
- Include at least one specific metric value and its benchmark comparison
- Close with a forward-looking statement grounded in the data
- ${DATA_GROUNDING_RULE}
- Be informative but accessible to a general audience`;
}
