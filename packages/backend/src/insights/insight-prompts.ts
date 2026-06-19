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

/** Plain-text prose style for the quick insights rendered directly in the UI. */
const PLAIN_PROSE_RULE =
  'Write plain prose only: no markdown or formatting (no bold, italics, headers, bullets, or backticks), no em-dashes (use a comma, period, or "and"), and no code-style identifiers (write field names in plain English). Keep all numbers exact.';

// ---------------------------------------------------------------------------
// Display helpers — keep raw keys and units out of the prompt so the model gets
// clean, plain-English, well-formatted numbers.
// ---------------------------------------------------------------------------

/** Plain-English labels for raw metric keys. */
const METRIC_LABELS: Record<string, string> = {
  home_value: 'median home value',
  rent_index: 'rent index',
  unemployment_rate: 'unemployment rate',
  median_income: 'median household income',
  days_on_market: 'days on market',
  for_sale_inventory: 'homes for sale',
  home_value_yoy: 'home value year over year',
  population_growth: 'population growth',
};

function labelFor(name: string): string {
  return METRIC_LABELS[name] ?? name.replace(/_/g, ' ');
}

/** Format a metric value: currency gets $ and commas; large counts get commas. */
function formatMetricValue(name: string, value: number | null): string {
  if (value == null) return 'N/A';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const lower = name.toLowerCase();
  if (
    lower.includes('value') ||
    lower.includes('income') ||
    lower.includes('price') ||
    lower.includes('rent')
  ) {
    return `$${Math.round(n).toLocaleString('en-US')}`;
  }
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('en-US');
  return String(Math.round(n * 100) / 100);
}

/**
 * The four PropertyIQ formula inputs live on the score's z_scores as raw values
 * (momentum/share are fractions, DOM is a count). Render each with a plain label
 * and correct units.
 */
const COMPONENT_ORDER = [
  'zhvi_yoy',
  'zhvi_mom_3m',
  'median_days_on_market',
  'price_reduced_share',
] as const;
const COMPONENT_META: Record<
  string,
  { label: string; fmt: (v: number) => string }
> = {
  zhvi_yoy: {
    label: 'home value momentum (12 month)',
    fmt: (v) => `${(v * 100).toFixed(2)}%`,
  },
  zhvi_mom_3m: {
    label: 'home value momentum (3 month)',
    fmt: (v) => `${(v * 100).toFixed(2)}%`,
  },
  median_days_on_market: {
    label: 'median days on market',
    fmt: (v) => `${Math.round(v)} days`,
  },
  price_reduced_share: {
    label: 'share of listings with a price cut',
    fmt: (v) => `${(v * 100).toFixed(1)}%`,
  },
};

/**
 * Format the top N score drivers as "label (formatted value)". Known PropertyIQ
 * inputs come first in a fixed order; any legacy/unknown components fall through.
 */
function formatTopComponents(
  components: InsightContext['score_components'],
  limit: number,
): string {
  const out: string[] = [];
  for (const key of COMPONENT_ORDER) {
    const comp = components[key];
    if (!comp || typeof comp.value !== 'number') continue;
    out.push(
      `${COMPONENT_META[key].label} (${COMPONENT_META[key].fmt(comp.value)})`,
    );
    if (out.length >= limit) return out.join(', ');
  }
  for (const [name, comp] of Object.entries(components)) {
    if (COMPONENT_META[name]) continue;
    out.push(`${labelFor(name)} (${comp.value})`);
    if (out.length >= limit) break;
  }
  return out.join(', ');
}

/**
 * Format key metrics as a compact single-line list with plain labels + values.
 */
function formatKeyMetrics(metrics: InsightContext['key_metrics']): string {
  return Object.entries(metrics)
    .map(
      ([name, { value }]) =>
        `${labelFor(name)}: ${formatMetricValue(name, value)}`,
    )
    .join(', ');
}

/**
 * Format benchmark comparisons when data is available.
 */
function formatBenchmarks(benchmarks: InsightContext['benchmarks']): string {
  const parts: string[] = [];
  const render = (entries: [string, number][]) =>
    entries
      .map(([k, v]) => `${labelFor(k)} ${formatMetricValue(k, v)}`)
      .join(', ');

  const stateEntries = Object.entries(benchmarks.state_avg);
  if (stateEntries.length > 0) {
    parts.push(`State averages: ${render(stateEntries)}`);
  }

  const nationalEntries = Object.entries(benchmarks.national_avg);
  if (nationalEntries.length > 0) {
    parts.push(`National averages: ${render(nationalEntries)}`);
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
- PropertyIQ Score: ${ctx.scores.propertyiq ?? 'N/A'}/100
- Top score drivers: ${topComponents}
- Key metrics: ${formatKeyMetrics(ctx.key_metrics)}
- Benchmarks:
${formatBenchmarks(ctx.benchmarks)}

Rules:
- Keep it to about 50 words (1-2 short sentences)
- Reference the score and at least one specific driver
- Compare to a benchmark if data is available
- ${DATA_GROUNDING_RULE}
- ${PLAIN_PROSE_RULE}
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
- PropertyIQ Score: ${ctx.scores.propertyiq ?? 'N/A'}/100
- Top 2 score components: ${topComponents}

Rules:
- Keep it to about 40 words (one or two short sentences)
- Reference the top 2 components and their status
- ${DATA_GROUNDING_RULE}
- ${PLAIN_PROSE_RULE}
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
- Keep it to about 50 words (1-2 sentences)
- Interpret the metric values compared to state and national averages
- Highlight whether the market is above or below benchmarks and what that implies
- ${DATA_GROUNDING_RULE}
- ${PLAIN_PROSE_RULE}
- Be conversational but data-grounded`;
}

/**
 * Market Overview — 500-800 word structured market analysis for landing pages.
 * Sections: Market Overview → Key Trends → Who Is This Market For → Outlook.
 * Uses markdown headers (##) for section delineation.
 */
export function buildMarketOverviewPrompt(ctx: InsightContext): string {
  const topComponents = formatTopComponents(ctx.score_components, 5);

  return `You are a real estate analyst writing an in-depth market analysis for a landing page.

Data for ${ctx.region_name}:
- PropertyIQ Score: ${ctx.scores.propertyiq ?? 'N/A'}/100
- Top score drivers: ${topComponents}
- Key metrics: ${formatKeyMetrics(ctx.key_metrics)}
- Benchmarks:
${formatBenchmarks(ctx.benchmarks)}

Rules:
- Write 500-800 words total
- Use these exact markdown section headers in order:
  ## Market Overview
  ## Key Trends
  ## Who Is This Market For
  ## Outlook
- "Market Overview": 2-3 paragraphs positioning the market (strong, moderate, weak), referencing scores and how they compare to benchmarks
- "Key Trends": Identify 3-4 data-driven trends from the metrics (price movement, inventory, affordability, etc.)
- "Who Is This Market For": Describe which buyer/investor profiles this market suits based on the scores (first-time buyers, investors, move-up buyers, etc.)
- "Outlook": A forward-looking paragraph grounded in the trend data — avoid speculation beyond what the numbers support
- Reference specific metric values and benchmark comparisons throughout
- ${DATA_GROUNDING_RULE}
- Be informative but accessible to a general audience
- Do NOT use bullet points — write in flowing paragraphs
- Do NOT include a title or introduction before the first ## header`;
}
