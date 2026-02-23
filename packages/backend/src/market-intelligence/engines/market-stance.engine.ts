/**
 * Market Stance Engine (Rule-Based)
 *
 * Pure function that computes a market stance (strong_bullish -> strong_bearish)
 * from metric values, news sentiment, and national benchmarks.
 * Deterministic, no AI involved.
 *
 * The stance is derived by evaluating each metric against predefined thresholds
 * to produce bullish or bearish signals, then counting signals to determine
 * the overall market stance. News sentiment is included as a signal source.
 */

import { NationalBenchmarks } from '../market-intelligence.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketStance =
  | 'strong_bullish'
  | 'weak_bullish'
  | 'neutral'
  | 'weak_bearish'
  | 'strong_bearish';

export interface StanceSignal {
  /** Machine-readable signal name (e.g. 'strong_appreciation', 'price_decline') */
  signal: string;
  /** Whether the signal is bullish or bearish */
  direction: 'bullish' | 'bearish';
  /** The actual metric value that triggered this signal */
  value: number | null;
  /** Human-readable description of the threshold that was crossed */
  threshold: string;
}

export interface StanceResult {
  stance: MarketStance;
  signals: StanceSignal[];
  bullish_count: number;
  bearish_count: number;
}

export interface StanceMetrics {
  /** Year-over-year appreciation percentage */
  appreciation_yoy: number | null;
  /** Population growth rate percentage */
  population_growth: number | null;
  /** Vacancy rate percentage */
  vacancy_rate: number | null;
  /** Year-over-year change in days on market (positive = increasing) */
  dom_yoy_change: number | null;
  /** HomeReady score (0-100) */
  homeready_score: number | null;
  /** Unemployment rate percentage */
  unemployment_rate: number | null;
  /** Cap rate percentage (annual rental yield) */
  cap_rate: number | null;
  /** Number of positive-sentiment news articles for this geography */
  positive_news_count: number;
  /** Number of negative-sentiment news articles for this geography */
  negative_news_count: number;
}

// ---------------------------------------------------------------------------
// Signal evaluation rules
// ---------------------------------------------------------------------------

interface SignalRule {
  /** Machine-readable signal name */
  signalName: string;
  direction: 'bullish' | 'bearish';
  /** The metric key this rule evaluates */
  metricKey: keyof StanceMetrics;
  /** Returns true if the metric value triggers this signal */
  evaluate: (value: number, benchmarks: NationalBenchmarks) => boolean;
  /** Returns a human-readable threshold description */
  describeThreshold: (benchmarks: NationalBenchmarks) => string;
}

const SIGNAL_RULES: SignalRule[] = [
  // --- Bullish signals (metrics) ---
  {
    signalName: 'strong_appreciation',
    direction: 'bullish',
    metricKey: 'appreciation_yoy',
    evaluate: (value) => value > 3,
    describeThreshold: () => 'appreciation_yoy > 3%',
  },
  {
    signalName: 'population_growth',
    direction: 'bullish',
    metricKey: 'population_growth',
    evaluate: (value) => value > 0.5,
    describeThreshold: () => 'population_growth > 0.5%',
  },
  {
    signalName: 'low_vacancy',
    direction: 'bullish',
    metricKey: 'vacancy_rate',
    evaluate: (value, benchmarks) => value < benchmarks.vacancy_rate,
    describeThreshold: (benchmarks) =>
      `vacancy_rate < national avg (${benchmarks.vacancy_rate}%)`,
  },
  {
    signalName: 'decreasing_dom',
    direction: 'bullish',
    metricKey: 'dom_yoy_change',
    evaluate: (value) => value < 0,
    describeThreshold: () => 'dom_yoy_change < 0 (decreasing)',
  },
  {
    signalName: 'strong_homeready',
    direction: 'bullish',
    metricKey: 'homeready_score',
    evaluate: (value) => value > 70,
    describeThreshold: () => 'homeready_score > 70',
  },
  {
    signalName: 'low_unemployment',
    direction: 'bullish',
    metricKey: 'unemployment_rate',
    evaluate: (value, benchmarks) => value < benchmarks.unemployment_rate - 0.5,
    describeThreshold: (benchmarks) =>
      `unemployment_rate < national avg - 0.5% (${(benchmarks.unemployment_rate - 0.5).toFixed(1)}%)`,
  },
  {
    signalName: 'strong_cap_rate',
    direction: 'bullish',
    metricKey: 'cap_rate',
    evaluate: (value) => value > 5,
    describeThreshold: () => 'cap_rate > 5% (strong rental yield)',
  },
  {
    signalName: 'positive_news_sentiment',
    direction: 'bullish',
    metricKey: 'positive_news_count',
    evaluate: (value) => value >= 2,
    describeThreshold: () => '2+ positive news articles in last 30 days',
  },

  // --- Bearish signals (metrics) ---
  {
    signalName: 'price_decline',
    direction: 'bearish',
    metricKey: 'appreciation_yoy',
    evaluate: (value) => value < 0,
    describeThreshold: () => 'appreciation_yoy < 0%',
  },
  {
    signalName: 'population_outflow',
    direction: 'bearish',
    metricKey: 'population_growth',
    evaluate: (value) => value < -0.3,
    describeThreshold: () => 'population_growth < -0.3%',
  },
  {
    signalName: 'high_vacancy',
    direction: 'bearish',
    metricKey: 'vacancy_rate',
    evaluate: (value, benchmarks) => value > benchmarks.vacancy_rate + 1,
    describeThreshold: (benchmarks) =>
      `vacancy_rate > national avg + 1% (${benchmarks.vacancy_rate + 1}%)`,
  },
  {
    signalName: 'rising_dom',
    direction: 'bearish',
    metricKey: 'dom_yoy_change',
    evaluate: (value) => value > 15,
    describeThreshold: () => 'dom_yoy_change > 15%',
  },
  {
    signalName: 'weak_homeready',
    direction: 'bearish',
    metricKey: 'homeready_score',
    evaluate: (value) => value < 45,
    describeThreshold: () => 'homeready_score < 45',
  },
  {
    signalName: 'high_unemployment',
    direction: 'bearish',
    metricKey: 'unemployment_rate',
    evaluate: (value, benchmarks) => value > benchmarks.unemployment_rate + 1.5,
    describeThreshold: (benchmarks) =>
      `unemployment_rate > national avg + 1.5% (${(benchmarks.unemployment_rate + 1.5).toFixed(1)}%)`,
  },
  {
    signalName: 'weak_cap_rate',
    direction: 'bearish',
    metricKey: 'cap_rate',
    evaluate: (value) => value < 2,
    describeThreshold: () => 'cap_rate < 2% (poor rental yield)',
  },
  {
    signalName: 'negative_news_sentiment',
    direction: 'bearish',
    metricKey: 'negative_news_count',
    evaluate: (value) => value >= 2,
    describeThreshold: () => '2+ negative news articles in last 30 days',
  },
];

// ---------------------------------------------------------------------------
// Stance determination
// ---------------------------------------------------------------------------

/**
 * Determines the market stance from signal counts.
 *
 * Rules:
 * - 4+ bullish signals  -> strong_bullish
 * - 2-3 bullish signals -> weak_bullish
 * - 4+ bearish signals  -> strong_bearish
 * - 2-3 bearish signals -> weak_bearish
 * - Otherwise           -> neutral
 *
 * When both bullish and bearish counts qualify for a stance,
 * the side with more signals wins. If tied, neutral.
 */
function determineStance(
  bullishCount: number,
  bearishCount: number,
): MarketStance {
  const bullishStrength = bullishCount >= 4 ? 2 : bullishCount >= 2 ? 1 : 0;
  const bearishStrength = bearishCount >= 4 ? 2 : bearishCount >= 2 ? 1 : 0;

  if (bullishStrength === 0 && bearishStrength === 0) {
    return 'neutral';
  }

  if (bullishStrength > bearishStrength) {
    return bullishStrength >= 2 ? 'strong_bullish' : 'weak_bullish';
  }

  if (bearishStrength > bullishStrength) {
    return bearishStrength >= 2 ? 'strong_bearish' : 'weak_bearish';
  }

  // Equal non-zero strength on both sides -> neutral
  return 'neutral';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Computes a market stance from metric values, news sentiment, and national
 * benchmarks.
 *
 * This is a pure, deterministic function with no side effects.
 * Null metric values are skipped (they produce no signal).
 *
 * @param metrics - The market's current metric values + news counts (nulls allowed)
 * @param nationalBenchmarks - National averages used as comparison baselines
 * @returns StanceResult with the stance, signals list, and signal counts
 */
export function computeMarketStance(
  metrics: StanceMetrics,
  nationalBenchmarks: NationalBenchmarks,
): StanceResult {
  const signals: StanceSignal[] = [];

  for (const rule of SIGNAL_RULES) {
    const metricValue = metrics[rule.metricKey];

    // Skip null/undefined metrics -- they produce no signal
    if (metricValue === null || metricValue === undefined) {
      continue;
    }

    if (rule.evaluate(metricValue, nationalBenchmarks)) {
      signals.push({
        signal: rule.signalName,
        direction: rule.direction,
        value: metricValue,
        threshold: rule.describeThreshold(nationalBenchmarks),
      });
    }
  }

  const bullishCount = signals.filter((s) => s.direction === 'bullish').length;
  const bearishCount = signals.filter((s) => s.direction === 'bearish').length;

  return {
    stance: determineStance(bullishCount, bearishCount),
    signals,
    bullish_count: bullishCount,
    bearish_count: bearishCount,
  };
}
