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
  propertyiq_score: number | null;
}

/** Metrics that map to score columns in propertyiq_scores */
export const SCORE_METRIC_COLUMNS: Record<string, keyof ScoreRow> = {
  propertyiq_score: 'propertyiq_score',
  propertyiq: 'propertyiq_score',
  // Backward compat: old names map to the unified score
  homeready_score: 'propertyiq_score',
  homeready: 'propertyiq_score',
  investoredge_score: 'propertyiq_score',
  investoredge: 'propertyiq_score',
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
