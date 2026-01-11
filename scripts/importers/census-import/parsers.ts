/**
 * Value Parsing Utilities
 */

import { MAX_INTEGER, MIN_INTEGER } from './types';

/**
 * Parse a Census value to number
 */
export function parseValue(value: string): number | null {
  if (value === null || value === undefined || value === '-666666666') {
    return null; // Census uses -666666666 for N/A
  }
  const num = parseFloat(value);
  if (isNaN(num)) return null;

  // Cap to PostgreSQL INTEGER range for safety
  if (num > MAX_INTEGER) return MAX_INTEGER;
  if (num < MIN_INTEGER) return MIN_INTEGER;

  return num;
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

/**
 * Parse to integer
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
 * Calculate percentage from part and total
 */
export function calculatePercentage(part: number | null, total: number | null): number | null {
  if (part === null || total === null || total === 0) return null;

  if (isNaN(part) || isNaN(total) || !isFinite(part) || !isFinite(total)) return null;
  if (total <= 0 || part < 0) return null;

  const pct = (part / total) * 100;

  if (!isFinite(pct) || isNaN(pct)) return null;
  if (pct > 100) return 100;
  if (pct < 0) return 0;

  const rounded = Math.round(pct * 100) / 100;
  if (!isFinite(rounded) || isNaN(rounded)) return null;

  return rounded;
}

/**
 * Safe numeric parser with bounds
 */
export function safeNumeric(val: string, min: number = 0, max: number = 200): number | null {
  const parsed = parseValue(val);
  if (parsed === null) return null;
  if (!isFinite(parsed) || isNaN(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  const rounded = Math.round(parsed * 100) / 100;
  if (!isFinite(rounded) || isNaN(rounded)) return null;
  return rounded;
}

/**
 * Safe percentage calculation with validation
 */
export function safePercentage(part: number | null, total: number | null): number | null {
  const pct = calculatePercentage(part, total);
  if (pct === null) return null;
  if (!isFinite(pct) || isNaN(pct)) return null;
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
}
