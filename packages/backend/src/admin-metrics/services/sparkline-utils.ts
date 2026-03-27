/**
 * Sparkline utility functions for MetricsQueryService.
 *
 * Extracted to keep MetricsQueryService within the 300-line hard limit.
 */

/**
 * Groups rows by calendar day and averages a numeric field per day.
 * Returns an array of daily averages ordered from oldest to newest.
 *
 * @param rows     - Array of objects containing a `timestamp` string field
 * @param getValue - Callback that extracts the numeric value from a row
 */
export function buildDailySparkline<T extends { timestamp: string }>(
  rows: T[],
  getValue: (row: T) => number | null,
): number[] {
  const buckets = new Map<string, number[]>();

  for (const row of rows) {
    const day = row.timestamp.slice(0, 10); // "YYYY-MM-DD"
    const value = getValue(row);
    if (value === null || value === undefined) continue;

    if (!buckets.has(day)) {
      buckets.set(day, []);
    }
    buckets.get(day)!.push(value);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, values]) => {
      const sum = values.reduce((acc, v) => acc + v, 0);
      return sum / values.length;
    });
}

/**
 * Counts events per calendar day for the past N days using a date field.
 * Returns an array of counts from oldest day to most recent.
 *
 * @param rows      - Array of objects with a string date field
 * @param dateField - Name of the date/timestamp field on each row
 * @param days      - Number of days to include (0 = current day)
 */
export function buildDailyCountSparkline<T extends Record<string, unknown>>(
  rows: T[],
  dateField: keyof T,
  days: number,
): number[] {
  // Build a map of day → count from row data
  const counts = new Map<string, number>();

  for (const row of rows) {
    const rawDate = row[dateField];
    if (typeof rawDate !== 'string') continue;
    const day = rawDate.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  // Generate the last N days (oldest first)
  const result: number[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    result.push(counts.get(day) ?? 0);
  }

  return result;
}
