/**
 * Report Follow-Up Types & Helpers
 *
 * Types for the follow-up alert system and pure utility functions
 * for parsing watch metrics from AI narrative JSON.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a metric entry from what_to_watch / actions_and_monitoring JSON */
export interface WatchMetricEntry {
  metric: string;
  current: string;
  threshold: string;
  direction: string;
  rationale: string;
}

/** Alert row from report_follow_up_alerts table */
export interface FollowUpAlert {
  id: string;
  report_id: string;
  user_id: string;
  metric_name: string;
  current_value: number | null;
  threshold_value: number;
  direction: 'up' | 'down';
  rationale: string | null;
  status: 'active' | 'triggered' | 'dismissed';
  triggered_at: string | null;
  created_at: string;
}

/** Market change entry comparing report-time vs current values */
export interface MarketChange {
  metric: string;
  oldValue: number;
  newValue: number;
  changePct: number;
}

/** Combined follow-up data for a report */
export interface ReportFollowUpData {
  alerts: FollowUpAlert[];
  marketChanges: MarketChange[];
  summary?: string;
}

/** Alert check result */
export interface AlertCheckResult {
  alertId: string;
  triggered: boolean;
}

/** Trackable metric extracted from populated_data */
export interface TrackableMetric {
  id: string;
  label: string;
  oldValue: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Metrics tracked for 30-day comparisons, mapped to display labels. */
export const TRACKED_METRIC_KEYS: Record<string, string> = {
  zhvi: 'Home Value (ZHVI)',
  zori: 'Rent Index (ZORI)',
  inventory_total: 'Total Inventory',
  days_on_market: 'Days on Market',
  months_of_supply: 'Months of Supply',
  unemployment_rate: 'Unemployment Rate',
  price_cut_pct: 'Price Cuts',
};

/** Minimum percent change to include in market change reports (filters noise). */
export const MIN_CHANGE_PERCENT = 1;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Type guard for valid watch metric entries. */
export function isValidWatchMetric(entry: unknown): entry is WatchMetricEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.metric === 'string' &&
    typeof e.threshold === 'string' &&
    typeof e.direction === 'string'
  );
}

/** Parse a numeric value from a string like "$425K", "3.2%", "28 days". */
export function parseNumericValue(raw: string | number | null): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return raw;

  const cleaned = raw
    .replace(/[$%,]/g, '')
    .replace(/K$/i, '000')
    .replace(/M$/i, '000000')
    .replace(/\s*(days|months|years).*$/i, '')
    .trim();

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extract watch metric entries from a narrative section.
 * Handles both parsed JSON objects and raw JSON strings.
 */
export function extractWatchMetrics(watchSection: unknown): WatchMetricEntry[] {
  if (!watchSection) return [];

  // If it's already a parsed object with metrics array
  if (typeof watchSection === 'object' && watchSection !== null) {
    const section = watchSection as Record<string, unknown>;
    if (Array.isArray(section.metrics)) {
      return section.metrics.filter(isValidWatchMetric);
    }
  }

  // If it's a JSON string, try to parse
  if (typeof watchSection === 'string') {
    try {
      const parsed = JSON.parse(watchSection);
      if (Array.isArray(parsed.metrics)) {
        return parsed.metrics.filter(isValidWatchMetric);
      }
    } catch {
      // Not valid JSON — no metrics to extract
    }
  }

  return [];
}

/** Extract trackable metric name/value pairs from populated_data. */
export function extractTrackableMetrics(
  populatedData: Record<string, unknown>,
): TrackableMetric[] {
  const results: TrackableMetric[] = [];

  for (const [key, label] of Object.entries(TRACKED_METRIC_KEYS)) {
    const value = populatedData[key];
    if (typeof value === 'number' && value !== 0) {
      results.push({ id: key, label, oldValue: value });
    }
  }

  return results;
}
