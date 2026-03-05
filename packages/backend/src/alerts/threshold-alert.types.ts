/**
 * Threshold Alert Types & Constants
 *
 * Shared types and configuration for the monthly threshold alert system.
 */

export interface ActiveAlert {
  id: string;
  user_id: string;
  geography_type: string;
  geography_id: string;
  geography_name: string | null;
  metric_id: string;
  condition: 'above' | 'below' | 'crosses';
  threshold: number;
  last_triggered_at: string | null;
}

export interface ScoreRow {
  geography_id: string;
  homeready_score: number | null;
  investoredge_score: number | null;
}

/** Metrics that map to score columns in propertyiq_scores */
export const SCORE_METRIC_COLUMNS: Record<string, keyof ScoreRow> = {
  homeready_score: 'homeready_score',
  homeready: 'homeready_score',
  investoredge_score: 'investoredge_score',
  investoredge: 'investoredge_score',
};

export function checkThreshold(
  condition: string,
  value: number,
  threshold: number,
): boolean {
  switch (condition) {
    case 'above':
      return value > threshold;
    case 'below':
      return value < threshold;
    case 'crosses':
      // For monthly threshold alerts, treat "crosses" as any side of threshold
      return value !== threshold;
    default:
      return false;
  }
}

/**
 * Returns true if the alert was already triggered during the current month.
 */
export function wasTriggeredThisMonth(lastTriggeredAt: string | null): boolean {
  if (!lastTriggeredAt) return false;
  const lastTriggered = new Date(lastTriggeredAt);
  const now = new Date();
  return (
    lastTriggered.getMonth() === now.getMonth() &&
    lastTriggered.getFullYear() === now.getFullYear()
  );
}
