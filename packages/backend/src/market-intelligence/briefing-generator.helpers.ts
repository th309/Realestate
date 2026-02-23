/**
 * Briefing Generator Helpers
 *
 * Pure helper functions extracted from BriefingGeneratorService to keep the
 * service under 300 lines. These handle metric snapshot building, stance/risk
 * metric extraction, freshness calculation, and narrative prompt formatting.
 */

import { ResolvedMetric } from '../metric-resolution/metric-resolution.types';
import { MetricSnapshot } from './market-intelligence.types';
import {
  StanceMetrics,
  StanceSignal,
} from './engines/market-stance.engine';
import { RiskMetrics, RiskFlag } from './engines/risk-flags.engine';

// ---------------------------------------------------------------------------
// Metric formatting
// ---------------------------------------------------------------------------

const FORMAT_RULES: Record<string, (v: number) => string> = {
  home_value: (v) => `$${(v / 1000).toFixed(0)}K`,
  rent_index: (v) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
  median_income: (v) => `$${(v / 1000).toFixed(0)}K`,
  population: (v) =>
    v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(1)}M`
      : `${(v / 1_000).toFixed(0)}K`,
  inventory: (v) => v.toLocaleString('en-US', { maximumFractionDigits: 0 }),
  dom: (v) => `${v.toFixed(0)} days`,
};

const PERCENT_METRICS = new Set([
  'appreciation_yoy',
  'rent_growth_yoy',
  'cap_rate',
  'vacancy_rate',
  'population_growth',
  'unemployment_rate',
  'permits_growth',
]);

/** Format a metric value for display in the snapshot */
export function formatMetricForSnapshot(
  metricId: string,
  value: number | null,
): string {
  if (value === null) return 'N/A';

  const customFormatter = FORMAT_RULES[metricId];
  if (customFormatter) return customFormatter(value);

  if (PERCENT_METRICS.has(metricId)) return `${value.toFixed(1)}%`;

  if (metricId === 'price_to_rent' || metricId === 'price_to_income') {
    return value.toFixed(1);
  }

  return value.toFixed(2);
}

// ---------------------------------------------------------------------------
// Metric snapshot building
// ---------------------------------------------------------------------------

/** Convert a resolved metric batch to a Record<string, MetricSnapshot> */
export function buildMetricsSnapshot(
  resolved: Record<string, ResolvedMetric>,
): Record<string, MetricSnapshot> {
  const snapshot: Record<string, MetricSnapshot> = {};

  for (const [metricId, metric] of Object.entries(resolved)) {
    snapshot[metricId] = {
      value: metric.value,
      formatted: formatMetricForSnapshot(metricId, metric.value),
      mom_change: null, // MoM change requires historical data; not available in batch resolution
      yoy_change: null, // YoY change requires historical data; not available in batch resolution
      date: metric.date,
      source: metric.source,
      is_inherited: metric.isInherited,
    };
  }

  return snapshot;
}

// ---------------------------------------------------------------------------
// Stance metric extraction
// ---------------------------------------------------------------------------

/**
 * Extract the 5 metrics needed for market stance computation.
 * Maps resolved metrics to the StanceMetrics shape.
 */
export function extractStanceMetrics(
  resolved: Record<string, ResolvedMetric>,
): StanceMetrics {
  return {
    appreciation_yoy: resolved.appreciation_yoy?.value ?? null,
    population_growth: resolved.population_growth?.value ?? null,
    vacancy_rate: resolved.vacancy_rate?.value ?? null,
    dom_yoy_change: null, // DOM YoY change requires time-series; not in batch
    homeready_score: null, // TODO: Wire up scoring service in Task 8
  };
}

// ---------------------------------------------------------------------------
// Risk metric extraction
// ---------------------------------------------------------------------------

/**
 * Extract the 8 metrics needed for risk flag computation.
 * Maps resolved metrics to the RiskMetrics shape.
 */
export function extractRiskMetrics(
  resolved: Record<string, ResolvedMetric>,
): RiskMetrics {
  return {
    population_growth: resolved.population_growth?.value ?? null,
    appreciation_yoy: resolved.appreciation_yoy?.value ?? null,
    vacancy_rate: resolved.vacancy_rate?.value ?? null,
    unemployment_rate: resolved.unemployment_rate?.value ?? null,
    inventory_yoy_change: null, // Inventory YoY change requires time-series
    dom_yoy_change: null, // DOM YoY change requires time-series
    price_to_income: resolved.price_to_income?.value ?? null,
    rent_growth_yoy: resolved.rent_growth_yoy?.value ?? null,
  };
}

// ---------------------------------------------------------------------------
// Freshness calculation
// ---------------------------------------------------------------------------

/** Calculate data freshness: age in days of the newest metric date */
export function calculateFreshness(
  snapshot: Record<string, MetricSnapshot>,
): number {
  let newestDate: Date | null = null;

  for (const metric of Object.values(snapshot)) {
    if (metric.date) {
      const d = new Date(metric.date);
      if (!isNaN(d.getTime()) && (newestDate === null || d > newestDate)) {
        newestDate = d;
      }
    }
  }

  if (!newestDate) return -1;

  const now = new Date();
  const diffMs = now.getTime() - newestDate.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Narrative prompt formatting
// ---------------------------------------------------------------------------

/** Format stance signals for prompt inclusion */
function formatSignals(signals: StanceSignal[]): string {
  if (signals.length === 0) return 'None detected';
  return signals
    .map(
      (s) =>
        `- ${s.direction.toUpperCase()}: ${s.signal} (${s.threshold}, actual: ${s.value})`,
    )
    .join('\n');
}

/** Format risk flags for prompt inclusion */
function formatRisks(flags: RiskFlag[]): string {
  if (flags.length === 0) return 'None detected';
  return flags
    .map((f) => `- [${f.severity.toUpperCase()}] ${f.flag}: ${f.detail}`)
    .join('\n');
}

/** Format metric snapshot for prompt inclusion */
function formatMetricsForPrompt(
  snapshot: Record<string, MetricSnapshot>,
): string {
  return Object.entries(snapshot)
    .filter(([, m]) => m.value !== null)
    .map(([id, m]) => `- ${id}: ${m.formatted} (source: ${m.source})`)
    .join('\n');
}

/** Build the narrative generation prompt */
export function buildNarrativePrompt(
  geographyName: string,
  stance: string,
  signals: StanceSignal[],
  riskFlags: RiskFlag[],
  metricsSnapshot: Record<string, MetricSnapshot>,
  newsHeadlines: string[],
): string {
  const formattedSignals = formatSignals(signals);
  const formattedRisks = formatRisks(riskFlags);
  const formattedMetrics = formatMetricsForPrompt(metricsSnapshot);
  const formattedNews =
    newsHeadlines.length > 0 ? newsHeadlines.join('\n') : 'No recent news';

  return `You are an expert real estate market analyst writing a brief for ${geographyName}.

MARKET STANCE: ${stance} (determined by data — do not contradict this)
SIGNALS:
${formattedSignals}
RISK FLAGS:
${formattedRisks}
KEY METRICS:
${formattedMetrics}
RECENT NEWS:
${formattedNews}

Write a 3-4 sentence analyst briefing. Be direct and opinionated consistent with the ${stance} stance. Include specific numbers. End with a forward-looking statement.`;
}

/** Build the suggested questions prompt */
export function buildSuggestedQuestionsPrompt(
  geographyName: string,
  stance: string,
): string {
  return `You are a real estate analyst assistant. Given the market "${geographyName}" with a "${stance}" outlook, generate exactly 3 follow-up questions an investor might ask. Return ONLY the 3 questions, one per line, numbered 1-3. No other text.`;
}

/** Parse LLM response for suggested questions into an array */
export function parseSuggestedQuestions(rawResponse: string): string[] {
  return rawResponse
    .split('\n')
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line.length > 10);
}

/** Build a fallback narrative when LLM is unavailable */
export function buildFallbackNarrative(
  geographyName: string,
  stance: string,
  metricsCount: number,
): string {
  const stanceLabel = stance.replace(/_/g, ' ');
  return `${geographyName} shows a ${stanceLabel} outlook based on ${metricsCount} available metrics. Further analysis is recommended for investment decisions.`;
}
