/**
 * Data Cards Health — table metadata
 *
 * Pure, stateless lookups for the per-table health probe: which column carries
 * the freshness date, the approximate expected row count for a coverage
 * percentage, and the date formatting/aging helpers. Extracted from
 * data-cards-health.service.ts for file-size compliance (CLAUDE.md §1.3).
 */

/**
 * Freshness date column per source table. `null` means the table has no date
 * dimension to probe (fall back to `id` ordering, no freshness).
 */
export function getDateColumn(tableName: string): string | null {
  const dateColumns: Record<string, string> = {
    zillow_zip: 'period_date',
    zillow_county: 'period_date',
    zillow_metro: 'period_date',
    zillow_state: 'period_date',
    realtor_zip: 'period_date',
    realtor_county: 'period_date',
    realtor_metro: 'period_date',
    realtor_state: 'period_date',
    census_zip: 'year',
    census_county: 'year',
    economic_county: 'period_date',
    economic_metro: 'period_date',
    permits_county: 'period_date',
    permits_state: 'period_date',
    calculated_metrics: 'period_date',
    // score_date (indexed via idx_piq_v2_latest), NOT created_at — created_at is
    // unindexed, so ordering by it seq-scans ~14M rows and times out. score_date
    // is also the meaningful data-recency date for scores.
    propertyiq_scores: 'score_date',
  };
  return dateColumns[tableName] || null;
}

/** Approximate expected record count per table, for a coverage percentage. */
export function getExpectedRecords(tableName: string): number {
  const expectedCounts: Record<string, number> = {
    zillow_zip: 33000,
    zillow_county: 3100,
    zillow_metro: 400,
    zillow_state: 51,
    realtor_zip: 30000,
    realtor_county: 3000,
    realtor_metro: 400,
    realtor_state: 51,
    census_zip: 33000,
    census_county: 3143,
    economic_county: 3143,
    economic_metro: 384,
    permits_county: 3143,
    calculated_metrics: 33000,
    propertyiq_scores: 30000,
  };
  return expectedCounts[tableName] || 1000;
}

/** Format a raw date/year into a short display label (e.g. "Dec 2025"). */
export function formatDate(date: string | number | null): string | null {
  if (!date) return null;
  if (typeof date === 'number') return String(date);
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return String(date);
  }
}

/** Whole days between now and a date string; null if unparseable. */
export function daysSinceDate(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}
