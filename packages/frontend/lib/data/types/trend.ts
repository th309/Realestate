/**
 * TREND DATA TYPES
 */

/**
 * Direction of a trend
 */
export type TrendDirection = "up" | "down" | "stable";

/**
 * Result from calculating trend data
 */
export interface TrendResult {
  currentValue: number | null;
  previousValue: number | null;
  percentChange: number | null;
  direction: TrendDirection;
  sparklineData: number[];
  label: string | null;
}
