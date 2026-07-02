/**
 * Percentile Calculation (pure)
 *
 * Computes percentile statistics from wide-format rows where metrics are
 * columns. No I/O — pure numeric logic.
 */

import { GeographyType } from './scoring.types';
import { PercentileStats } from './percentile.types';

/**
 * Calculate percentiles from wide-format rows where metrics are columns
 */
export function calculateMetricPercentilesFromRows(
  rows: Record<string, unknown>[],
  metricName: string,
  geographyType: GeographyType,
  periodDate: string,
): PercentileStats | null {
  // Extract values for this metric column from all rows
  const values: number[] = [];
  for (const row of rows) {
    const val = row[metricName];
    if (val === null || val === undefined) continue;

    // Handle both number and string values (database may store as text)
    let numVal: number;
    if (typeof val === 'number') {
      numVal = val;
    } else if (typeof val === 'string') {
      numVal = parseFloat(val);
    } else {
      continue;
    }

    if (!isNaN(numVal) && isFinite(numVal)) {
      values.push(numVal);
    }
  }

  if (values.length < 5) {
    // Need at least 5 values for meaningful percentiles (reduced from 10 for states)
    console.log(
      `Skipping ${metricName}: only ${values.length} non-null values`,
    );
    return null;
  }

  // Sort values for percentile calculation
  values.sort((a, b) => a - b);
  const count = values.length;

  // Calculate percentiles
  const getPercentile = (arr: number[], percentile: number): number => {
    const index = Math.floor((percentile / 100) * arr.length);
    return arr[Math.min(index, arr.length - 1)];
  };

  // Calculate mean
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;

  // Calculate standard deviation
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / count;
  const stddev = Math.sqrt(avgSquaredDiff);

  return {
    metricName,
    geographyType,
    periodDate,
    p10: getPercentile(values, 10),
    p20: getPercentile(values, 20),
    p30: getPercentile(values, 30),
    p40: getPercentile(values, 40),
    p50: getPercentile(values, 50),
    p60: getPercentile(values, 60),
    p70: getPercentile(values, 70),
    p80: getPercentile(values, 80),
    p90: getPercentile(values, 90),
    min: values[0],
    max: values[count - 1],
    count,
    mean,
    stddev,
  };
}
