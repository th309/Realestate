/**
 * Shared score helper utilities used across report sections.
 *
 * Extracted from duplicated definitions in Hero, InvestorHero, ExecutiveSummary,
 * InvestmentThesis, ScoreStory, InvestorScoreStory, ComparisonHero,
 * HeadToHeadScoreStory, ComponentShowdown, and MarketStrengths.
 */

import type { ScoreComponentBreakdown } from '@/lib/data';

// ---------------------------------------------------------------------------
// Score color / grade / label helpers
// ---------------------------------------------------------------------------

/** Map a numeric score to a CSS custom-property stroke color. */
export function getScoreStrokeColor(score: number): string {
  if (score >= 70) return 'var(--report-success)';
  if (score >= 50) return 'var(--report-warning)';
  return 'var(--report-error)';
}

/** Derive a letter grade from a numeric score. */
export function getScoreGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C+';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/** Derive a human-readable label from a numeric score. */
export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Below Average';
  return 'Challenging';
}

// ---------------------------------------------------------------------------
// Confidence helpers
// ---------------------------------------------------------------------------

/** Determine confidence level from report data or component coverage. */
export function deriveConfidence(
  reportConfidence: 'high' | 'medium' | 'low' | null,
  components?: ScoreComponentBreakdown[],
): 'HIGH' | 'MEDIUM' | 'LOW' | null {
  // Prefer the explicit report-level confidence
  if (reportConfidence) {
    return reportConfidence.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW';
  }

  // Fall back to deriving from component data coverage
  if (!components || components.length === 0) return null;

  const avgMetrics =
    components.reduce((sum, c) => sum + (c.contributing_metrics?.length ?? 0), 0) /
    components.length;

  if (avgMetrics >= 3) return 'HIGH';
  if (avgMetrics >= 2) return 'MEDIUM';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Prettify a component name (e.g. "price_stability") into a readable label. */
export function formatComponentLabel(component: string): string {
  return component
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
