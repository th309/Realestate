/**
 * Score Data Types
 *
 * Type definitions and utilities for PropertyIQ score data.
 * Used by useScoreData hook and score display components.
 */

export type ScoreType =
  | "market_health"
  | "homeready"
  | "investoredge"
  | "propertyiq";
export type GeographyType =
  | "national"
  | "state"
  | "metro"
  | "county"
  | "city"
  | "zip"
  | "tract";
export type ScoreAccess = "full" | "teaser";
export type TrendDirection = "up" | "down" | "stable";
export type ConfidenceLevel = "a" | "b" | "c" | "f";

/**
 * Normalize confidence level from backend to lowercase letter grade.
 * Handles both new format (A/B/C/F) and legacy format (HIGH/MEDIUM/LOW/INSUFFICIENT)
 * for backward compatibility with existing DB rows until scores are recalculated.
 */
const LEGACY_CONFIDENCE_MAP: Record<string, ConfidenceLevel> = {
  high: "a",
  medium: "b",
  low: "c",
  insufficient: "f",
};

export function normalizeConfidenceLevel(
  raw: string | null | undefined,
): ConfidenceLevel {
  if (!raw) return "b";
  const lower = raw.toLowerCase();
  // New format: already a/b/c/f
  if (lower === "a" || lower === "b" || lower === "c" || lower === "f")
    return lower;
  // Legacy format: high/medium/low/insufficient
  return LEGACY_CONFIDENCE_MAP[lower] ?? "b";
}

export interface MetricDetail {
  name: string;
  value: number | null;
  normalizedScore: number | null;
  formatted: string;
  target?: string;
  isInherited: boolean;
  sourceGeographyType?: string;
  sourceGeographyName?: string;
  description: string;
  impact: "positive" | "negative" | "neutral";
}

export interface ComponentDetail {
  name: string;
  label: string;
  weight: number;
  score: number;
  weightedContribution: number;
  description: string;
  metrics: MetricDetail[];
  helpingFactors: string[];
  hurtingFactors: string[];
}

export interface ConfidenceInfo {
  level: ConfidenceLevel;
  percentage: number;
  metricsAvailable: number;
  metricsTotal: number;
  freshnessInDays: number;
  warning?: string;
}

export interface HistoryPoint {
  date: string;
  score: number | null;
}

export interface ScoreHistory {
  data: HistoryPoint[];
  months: number;
  trend: TrendDirection;
  change: number;
}

export interface UpgradeCta {
  headline: string;
  description: string;
  buttonText: string;
  upgradeUrl: string;
  requiredTier: string;
  features: string[];
}

export interface ScoreBadgeData {
  type: ScoreType;
  label: string;
  score: number | null;
  trend: TrendDirection;
  /** 3-month change in points; undefined when backend has no history (single score_date) */
  trendChange?: number;
  access: ScoreAccess;
  status: "complete" | "partial" | "unavailable";
  statusMessage?: string;
  periodDate: string;
}

export interface ScoreCardData extends ScoreBadgeData {
  components: ComponentDetail[];
  confidence: ConfidenceInfo;
  history?: ScoreHistory;
  dataCompleteness: number;
  inheritedMetricsCount: number;
  inheritedMetrics?: Record<string, string>;
}

export interface ScoreTeaserData extends ScoreBadgeData {
  lockedComponents: Array<{
    name: string;
    label: string;
    weight: number;
    blurredScore: string;
  }>;
  upgradeCta: UpgradeCta;
  teaserDescription?: string;
}

export interface AllScoresResponse {
  geographyId: string;
  geographyType: GeographyType;
  geographyName: string;
  stateCode?: string;
  periodDate: string;
  userTier: string;
  /** Primary unified PropertyIQ score */
  propertyiq?: ScoreBadgeData | ScoreCardData | ScoreTeaserData;
  /** @deprecated Legacy score types — kept for backward compatibility */
  marketHealth: ScoreBadgeData | ScoreCardData;
  /** @deprecated Legacy score types — kept for backward compatibility */
  homeready: ScoreBadgeData | ScoreCardData | ScoreTeaserData;
  /** @deprecated Legacy score types — kept for backward compatibility */
  investoredge: ScoreBadgeData | ScoreCardData | ScoreTeaserData;
  calculatedAt: string;
  calculationVersion: string;
}

export interface UseScoreDataOptions {
  expanded?: boolean;
  /** 0-6; omit for latest scores only. Pass only when you need trend/history (e.g. 3-month change). */
  historyMonths?: number;
  /** 3 or 5; for extended history with outcomes validation. */
  historyYears?: number;
  /** true to include actual returns and benchmark comparisons. */
  includeOutcomes?: boolean;
  userTier?: string;
}

export interface UseScoreDataReturn {
  data: AllScoresResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
