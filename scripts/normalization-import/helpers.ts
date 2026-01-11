/**
 * Helper utilities for Normalization CSV Import
 */

/**
 * Normalize FIPS code with proper zero-padding
 */
export function normalizeFIPS(fips: string, length: number): string {
  if (!fips) return '';
  return fips.toString().padStart(length, '0');
}

/**
 * Convert LSAD type string to code
 */
export function convertLSAD(type: string): string | null {
  if (type === 'Metropolitan Statistical Area') return 'M1';
  if (type === 'Micropolitan Statistical Area') return 'M2';
  return null;
}

/**
 * Clean county name by removing "County" suffix
 */
export function cleanCountyName(name: string): string {
  if (!name) return '';
  return name.replace(/\s+County$/i, '').trim();
}

/**
 * Parse percentage value from string or number
 * Handles both decimal (0.5) and percentage (50) formats
 */
export function parsePercentage(value: string | number): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const num = parseFloat(value.toString());
  if (isNaN(num)) return null;
  // If > 1, assume it's a percentage (e.g., 50.5) and convert to decimal
  return num > 1 ? num / 100 : num;
}

/**
 * Escape value for SQL insertion
 */
export function escapeSQL(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  // Escape single quotes and backslashes
  return `'${value.toString().replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
