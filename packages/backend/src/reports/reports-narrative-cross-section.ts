/**
 * Cross-Section Context Helpers for Narrative Templates
 *
 * Computes derived template variables that provide cross-section context
 * for AI narrative coherence: component extremes, market tensions, and
 * user goal summaries.
 *
 * Extracted from reports-narrative-template-vars.ts to stay within
 * file size limits.
 */

import type { GenerateReportDto } from './dto/generate-report.dto';

const formatName = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Find strongest and weakest score components for cross-section context.
 */
export function computeComponentExtremes(
  scores: any,
  userType: string,
): Record<string, string | number> {
  // Always use propertyiq; fall back to legacy types for old data
  const scoreType = 'propertyiq';
  const rawComponents =
    scores?.scores?.[scoreType]?.components ||
    scores?.scores?.[userType === 'investor' ? 'investoredge' : 'homeready']
      ?.components;
  // Defensive: only legacy multi-component scores yield an array. v4 PropertyIQ
  // has none, and a non-array here (e.g. a raw z_scores Record) must NOT reach
  // the [...components] spread below — that throws "components is not iterable".
  const components: Array<{ component: string; score: number }> = Array.isArray(
    rawComponents,
  )
    ? rawComponents
    : [];

  if (components.length === 0) {
    return {
      strongest_component: 'N/A',
      strongest_score: 'N/A',
      weakest_component: 'N/A',
      weakest_score: 'N/A',
    };
  }

  const sorted = [...components].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  return {
    strongest_component: formatName(strongest.component),
    strongest_score: Math.round(strongest.score),
    weakest_component: formatName(weakest.component),
    weakest_score: Math.round(weakest.score),
  };
}

/**
 * Derive a key market tension from component score gaps.
 */
export function computeKeyTension(scores: any, userType: string): string {
  // Always use propertyiq; fall back to legacy types for old data
  const scoreType = 'propertyiq';
  const rawComponents =
    scores?.scores?.[scoreType]?.components ||
    scores?.scores?.[userType === 'investor' ? 'investoredge' : 'homeready']
      ?.components;
  // Defensive: only legacy multi-component scores yield an array. v4 PropertyIQ
  // has none, and a non-array here (e.g. a raw z_scores Record) must NOT reach
  // the [...components] spread below — that throws "components is not iterable".
  const components: Array<{ component: string; score: number }> = Array.isArray(
    rawComponents,
  )
    ? rawComponents
    : [];

  if (components.length < 2) return 'Insufficient data for tension analysis';

  const sorted = [...components].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const gap = best.score - worst.score;

  if (gap < 15) {
    return `Balanced profile — all components within ${Math.round(gap)} points of each other`;
  }

  return `Strong ${formatName(best.component)} (${Math.round(best.score)}) but weak ${formatName(worst.component)} (${Math.round(worst.score)}) — a ${Math.round(gap)}-point gap that defines this market's trade-off`;
}

/**
 * Summarize the user's goal and profile for cross-section context.
 */
export function computeUserGoalSummary(
  dto: GenerateReportDto,
  priorities: string[],
): string {
  const parts: string[] = [];
  parts.push(
    dto.user_type === 'investor' ? 'Real estate investor' : 'Homebuyer',
  );

  if (priorities.length > 0) {
    parts.push(`prioritizing ${priorities.map(formatName).join(', ')}`);
  }

  const inputs = dto.user_inputs || {};
  if (inputs.user_income) parts.push(`income ${inputs.user_income}`);
  if (inputs.user_budget) parts.push(`budget ${inputs.user_budget}`);
  if (inputs.user_timeline) parts.push(`timeline: ${inputs.user_timeline}`);

  return parts.join(' — ');
}
