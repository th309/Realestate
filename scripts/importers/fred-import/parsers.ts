/**
 * Value Parsing Utilities
 */

import { MAX_INTEGER, MIN_INTEGER } from './types';

/**
 * Parse a FRED value to number
 */
export function parseValue(value: string): number | null {
  if (value === null || value === undefined || value === '.') {
    return null; // FRED uses '.' for missing values
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse to integer with bounds
 */
export function parseInteger(value: string): number | null {
  const parsed = parseValue(value);
  if (parsed === null) return null;
  const rounded = Math.round(parsed);
  if (rounded > MAX_INTEGER) return MAX_INTEGER;
  if (rounded < MIN_INTEGER) return MIN_INTEGER;
  return rounded;
}

/**
 * Parse numeric value with max bound
 */
export function parseNumeric(value: string, maxValue: number = 999999999999): number | null {
  const parsed = parseValue(value);
  if (parsed === null) return null;
  if (parsed > maxValue) return maxValue;
  if (parsed < -maxValue) return -maxValue;
  return Math.round(parsed * 100) / 100;
}
