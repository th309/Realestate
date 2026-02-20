/**
 * Data parsing utilities for import scripts.
 *
 * Handles common data cleaning tasks: null/NA detection, numeric parsing,
 * date normalization, and geographic ID padding.
 */

/** Values treated as null/missing in CSV data. */
const NULL_VALUES = new Set(['', 'null', 'NULL', 'NA', 'N/A', 'n/a', '#N/A', '.', '-']);

/**
 * Parse a string value to a floating-point number.
 * Returns null for empty, null-like, or non-numeric values.
 * Strips commas before parsing (e.g., "1,234,567" -> 1234567).
 */
export function parseNumeric(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (NULL_VALUES.has(trimmed)) return null;

  const cleaned = trimmed.replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse a string value to an integer.
 * Returns null for empty, null-like, or non-numeric values.
 * Strips commas before parsing.
 */
export function parseInteger(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (NULL_VALUES.has(trimmed)) return null;

  const cleaned = trimmed.replace(/,/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Convert a YYYYMM string (e.g., "202401") to a date string "YYYY-MM-01".
 * Returns null if the input is not a valid 6-digit year-month.
 */
export function parseYearMonth(yyyymm: string | null | undefined): string | null {
  if (yyyymm == null) return null;
  const trimmed = yyyymm.trim();
  if (!/^\d{6}$/.test(trimmed)) return null;

  const year = trimmed.substring(0, 4);
  const month = trimmed.substring(4, 6);
  const monthNum = parseInt(month, 10);
  if (monthNum < 1 || monthNum > 12) return null;

  return `${year}-${month}-01`;
}

/**
 * Pad a ZIP code to 5 digits with leading zeros.
 * Returns null if input is empty or null-like.
 */
export function normalizeZipCode(zip: string | null | undefined): string | null {
  if (zip == null) return null;
  const trimmed = zip.trim();
  if (NULL_VALUES.has(trimmed)) return null;

  // Strip any non-digit characters and take first 5
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return null;

  return digits.padStart(5, '0').substring(0, 5);
}

/**
 * Pad a FIPS code to the specified length with leading zeros.
 * Default length is 5 (county FIPS = 2-digit state + 3-digit county).
 * Returns null if input is empty or null-like.
 */
export function normalizeFipsCode(fips: string | null | undefined, length: number = 5): string | null {
  if (fips == null) return null;
  const trimmed = fips.trim();
  if (NULL_VALUES.has(trimmed)) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return null;

  return digits.padStart(length, '0');
}

/**
 * Parse a percentage string, stripping the % sign.
 * Handles both "5.2%" and "5.2" formats.
 * Returns null for empty or non-numeric values.
 */
export function parsePercent(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (NULL_VALUES.has(trimmed)) return null;

  const cleaned = trimmed.replace(/%/g, '').replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}
