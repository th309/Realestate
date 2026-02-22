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

/** Map legacy confidence strings (e.g. 'high') to letter grades. */
const CONFIDENCE_ALIAS: Record<string, 'A' | 'B' | 'C' | 'F'> = {
  high: 'A',
  good: 'B',
  medium: 'B',
  fair: 'C',
  low: 'C',
  poor: 'F',
  a: 'A',
  b: 'B',
  c: 'C',
  f: 'F',
};

const VALID_CONFIDENCE = new Set<string>(['A', 'B', 'C', 'F']);

/** Determine confidence level from report data or component coverage. */
export function deriveConfidence(
  reportConfidence: string | null,
  components?: ScoreComponentBreakdown[],
): 'A' | 'B' | 'C' | 'F' | null {
  // Prefer the explicit report-level confidence
  if (reportConfidence) {
    const mapped = CONFIDENCE_ALIAS[reportConfidence.toLowerCase()];
    if (mapped) return mapped;
    const upper = reportConfidence.toUpperCase();
    if (VALID_CONFIDENCE.has(upper)) return upper as 'A' | 'B' | 'C' | 'F';
    return null; // Unrecognized value — skip rather than crash
  }

  // Fall back to deriving from component data coverage
  if (!components || components.length === 0) return null;

  const avgMetrics =
    components.reduce((sum, c) => sum + (c.contributing_metrics?.length ?? 0), 0) /
    components.length;

  if (avgMetrics >= 3) return 'A';
  if (avgMetrics >= 2) return 'B';
  return 'C';
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
