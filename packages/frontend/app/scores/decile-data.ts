export interface DecileRow {
  score: number;
  /** Mean cumulative 3-year excess return vs state (%) */
  meanExcess: number;
  /** Median cumulative 3-year excess return vs state (%) */
  medianExcess: number;
  /** Std dev of the 3-year excess return (%) */
  stdDev: number;
  /** Mean cumulative 3-year total return of the market itself (%) */
  totalReturn: number;
  /** Share of markets in this decile that beat their state (%) */
  pBeatState: number;
  n: number;
}

/**
 * SINGLE SOURCE OF TRUTH for the per-decile PropertyIQ metro performance shown
 * on /scores (decile table) AND /scores/methodology (Cost of Choosing Wrong
 * dollar table). Both pages derive from this so the numbers can never drift.
 *
 * Metro score backtest, 2001-2023, 3-year horizon. PropertyIQ Score =
 * z(zhvi_yoy) + z(zhvi_mom_3m) - z(median_days_on_market) - z(price_reduced_share).
 */
export const METRO_DECILE_3Y: DecileRow[] = [
  {
    score: 10,
    meanExcess: -4.36,
    medianExcess: -3.51,
    stdDev: 13.1,
    totalReturn: 6.91,
    pBeatState: 32.4,
    n: 17392,
  },
  {
    score: 20,
    meanExcess: -2.5,
    medianExcess: -2.03,
    stdDev: 11.0,
    totalReturn: 9.58,
    pBeatState: 37.4,
    n: 18446,
  },
  {
    score: 30,
    meanExcess: -1.92,
    medianExcess: -1.35,
    stdDev: 10.3,
    totalReturn: 11.04,
    pBeatState: 40.9,
    n: 18364,
  },
  {
    score: 40,
    meanExcess: -1.21,
    medianExcess: -0.84,
    stdDev: 11.4,
    totalReturn: 12.45,
    pBeatState: 43.9,
    n: 18423,
  },
  {
    score: 50,
    meanExcess: -0.72,
    medianExcess: -0.45,
    stdDev: 11.0,
    totalReturn: 13.53,
    pBeatState: 46.8,
    n: 18376,
  },
  {
    score: 60,
    meanExcess: -0.34,
    medianExcess: -0.14,
    stdDev: 11.6,
    totalReturn: 14.8,
    pBeatState: 49.0,
    n: 18609,
  },
  {
    score: 70,
    meanExcess: -0.11,
    medianExcess: 0.09,
    stdDev: 12.0,
    totalReturn: 16.37,
    pBeatState: 50.6,
    n: 18580,
  },
  {
    score: 80,
    meanExcess: -0.19,
    medianExcess: 0.08,
    stdDev: 11.4,
    totalReturn: 17.8,
    pBeatState: 50.4,
    n: 18604,
  },
  {
    score: 90,
    meanExcess: 0.47,
    medianExcess: 0.79,
    stdDev: 11.1,
    totalReturn: 19.61,
    pBeatState: 54.9,
    n: 18641,
  },
  {
    score: 100,
    meanExcess: 1.94,
    medianExcess: 1.54,
    stdDev: 13.0,
    totalReturn: 22.13,
    pBeatState: 58.5,
    n: 15973,
  },
];

/** Median metro home value (Zillow ZHVI, April 2026) used for dollar conversions. */
export const MEDIAN_METRO_HOME = 251_629;
