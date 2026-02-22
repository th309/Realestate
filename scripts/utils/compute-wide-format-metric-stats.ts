/**
 * Compute per-metric stats from wide-format parsed records.
 *
 * Wide-format tables (economic_*, census_*) store metrics as columns
 * rather than a `metric_name` column. This utility iterates parsed records
 * and computes per-metric statistics needed for `logIngestionDetail()`.
 */

export interface WideFormatMetricStats {
  /** Number of records where this metric column is non-null */
  count: number;
  /** Latest date value (ISO string) across all records with non-null metric */
  latestDate: string | null;
  /** Count of distinct region IDs with non-null metric values */
  regionCount: number;
}

/**
 * Compute per-metric stats from an array of parsed wide-format records.
 *
 * @param records - Parsed CSV records (array of objects)
 * @param metricColumns - Column names that represent metric values
 * @param dateField - Field name for the date/period ('period_date' or 'year')
 * @param geoField - Field name for the region ID (e.g. 'state_fips', 'cbsa_code'), null for national
 */
export function computeWideFormatMetricStats(
  records: any[],
  metricColumns: string[],
  dateField: string,
  geoField: string | null,
): Map<string, WideFormatMetricStats> {
  const statsMap = new Map<string, {
    count: number;
    maxDate: Date | null;
    regionIds: Set<string>;
  }>();

  // Initialize
  for (const col of metricColumns) {
    statsMap.set(col, { count: 0, maxDate: null, regionIds: new Set() });
  }

  for (const record of records) {
    // Parse the date field
    const rawDate = record[dateField];
    let dateValue: Date | null = null;
    if (rawDate instanceof Date) {
      dateValue = rawDate;
    } else if (typeof rawDate === 'number') {
      // year field (e.g. 2023) — treat as Jan 1 of that year
      dateValue = new Date(`${rawDate}-01-01`);
    } else if (typeof rawDate === 'string') {
      dateValue = new Date(rawDate);
    }

    const regionId = geoField ? String(record[geoField] ?? '') : 'national';

    for (const col of metricColumns) {
      const value = record[col];
      if (value === null || value === undefined) continue;

      const stats = statsMap.get(col)!;
      stats.count++;

      if (regionId) {
        stats.regionIds.add(regionId);
      }

      if (dateValue && (!stats.maxDate || dateValue > stats.maxDate)) {
        stats.maxDate = dateValue;
      }
    }
  }

  // Convert to output format
  const result = new Map<string, WideFormatMetricStats>();
  for (const [col, stats] of statsMap) {
    result.set(col, {
      count: stats.count,
      latestDate: stats.maxDate ? stats.maxDate.toISOString().split('T')[0] : null,
      regionCount: stats.regionIds.size,
    });
  }

  return result;
}
