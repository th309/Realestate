export interface DecileRow {
  score: number;
  meanExcess: number;
  medianExcess: number;
  stdDev: number;
  pBeatState: number;
  n: number;
}

export const METRO_DECILE_1Y: DecileRow[] = [
  {
    score: 10,
    meanExcess: -2.11,
    medianExcess: -1.66,
    stdDev: 5.6,
    pBeatState: 34.0,
    n: 13048,
  },
  {
    score: 20,
    meanExcess: -1.26,
    medianExcess: -1.08,
    stdDev: 5.0,
    pBeatState: 38.8,
    n: 13826,
  },
  {
    score: 30,
    meanExcess: -0.84,
    medianExcess: -0.73,
    stdDev: 4.7,
    pBeatState: 41.7,
    n: 13816,
  },
  {
    score: 40,
    meanExcess: -0.47,
    medianExcess: -0.36,
    stdDev: 4.5,
    pBeatState: 46.0,
    n: 13823,
  },
  {
    score: 50,
    meanExcess: -0.15,
    medianExcess: -0.09,
    stdDev: 4.5,
    pBeatState: 49.0,
    n: 13676,
  },
  {
    score: 60,
    meanExcess: 0.07,
    medianExcess: 0.07,
    stdDev: 4.3,
    pBeatState: 51.0,
    n: 11037,
  },
  {
    score: 70,
    meanExcess: 0.23,
    medianExcess: 0.28,
    stdDev: 4.3,
    pBeatState: 53.9,
    n: 11030,
  },
  {
    score: 80,
    meanExcess: 0.53,
    medianExcess: 0.48,
    stdDev: 4.3,
    pBeatState: 56.0,
    n: 11027,
  },
  {
    score: 90,
    meanExcess: 1.03,
    medianExcess: 0.79,
    stdDev: 4.5,
    pBeatState: 59.9,
    n: 11033,
  },
  {
    score: 100,
    meanExcess: 1.64,
    medianExcess: 1.32,
    stdDev: 4.4,
    pBeatState: 66.1,
    n: 9461,
  },
];

export const METRO_DECILE_3Y: DecileRow[] = [
  {
    score: 10,
    meanExcess: -5.66,
    medianExcess: -4.81,
    stdDev: 13.1,
    pBeatState: 32.3,
    n: 10948,
  },
  {
    score: 20,
    meanExcess: -3.34,
    medianExcess: -2.64,
    stdDev: 12.8,
    pBeatState: 39.2,
    n: 11601,
  },
  {
    score: 30,
    meanExcess: -2.04,
    medianExcess: -1.76,
    stdDev: 11.8,
    pBeatState: 42.4,
    n: 11594,
  },
  {
    score: 40,
    meanExcess: -1.2,
    medianExcess: -1.11,
    stdDev: 11.5,
    pBeatState: 45.3,
    n: 11604,
  },
  {
    score: 50,
    meanExcess: -0.28,
    medianExcess: -0.35,
    stdDev: 11.2,
    pBeatState: 48.4,
    n: 11479,
  },
  {
    score: 60,
    meanExcess: 0.31,
    medianExcess: 0.26,
    stdDev: 10.9,
    pBeatState: 51.2,
    n: 9267,
  },
  {
    score: 70,
    meanExcess: 1.17,
    medianExcess: 1.01,
    stdDev: 10.6,
    pBeatState: 55.4,
    n: 9251,
  },
  {
    score: 80,
    meanExcess: 1.87,
    medianExcess: 1.44,
    stdDev: 11.3,
    pBeatState: 56.4,
    n: 9249,
  },
  {
    score: 90,
    meanExcess: 3.05,
    medianExcess: 2.06,
    stdDev: 11.7,
    pBeatState: 59.3,
    n: 9257,
  },
  {
    score: 100,
    meanExcess: 4.28,
    medianExcess: 3.12,
    stdDev: 11.8,
    pBeatState: 63.7,
    n: 7943,
  },
];
