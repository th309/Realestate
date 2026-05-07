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

function signalStrength(count: number): number {
  if (count >= 4) return 2;
  if (count >= 2) return 1;
  return 0;
}

function determineStance(
  bullishCount: number,
  bearishCount: number,
): MarketStance {
  const bullish = signalStrength(bullishCount);
  const bearish = signalStrength(bearishCount);

  if (bullish === 0 && bearish === 0) return 'neutral';
  if (bullish === bearish) return 'neutral';

  if (bullish > bearish) {
    return bullish >= 2 ? 'strong_bullish' : 'weak_bullish';
  }

  return bearish >= 2 ? 'strong_bearish' : 'weak_bearish';
}

/** Compute a market stance from metric values and national benchmarks. Pure and deterministic. */
export function computeMarketStance(
  metrics: StanceMetrics,
  nationalBenchmarks: NationalBenchmarks,
): StanceResult {
  const signals: StanceSignal[] = [];

  for (const rule of SIGNAL_RULES) {
    const metricValue = metrics[rule.metricKey];
    if (metricValue == null) continue;

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
