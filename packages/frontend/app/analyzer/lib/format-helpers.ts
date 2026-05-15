/**
 * Tiny presentation helpers shared across AnalyzerClient + section composers.
 * Kept outside `@/lib/data/format` because these are analyzer-redesign-specific
 * formatting choices (e.g. "—" sentinel for null instead of "$0").
 */

export const fmtPct = (v: number | null): string =>
  v == null ? "—" : `${(v * 100).toFixed(1)}%`;

export const fmtUsd = (v: number | null): string =>
  v == null ? "—" : `$${Math.round(v).toLocaleString()}`;

export const fmtRatio = (v: number | null): string =>
  v == null ? "—" : v.toFixed(2);

/**
 * Derive a 0-100 grade score from rental metrics.
 *
 * Rough heuristic intentionally — the analyzer's headline grade is a
 * gut-check, not a research-grade ranking. Cap rate dominates; DSCR
 * adjusts ±20 around it. Expand later via PIQ + sensitivity if needed.
 */
export function deriveGradeScore(
  capRatePct: number | null,
  dscr: number | null,
): number {
  if (capRatePct == null) return 50;
  let score = capRatePct * 8; // 8% cap → 64
  if (dscr != null) score += Math.max(-20, Math.min(20, (dscr - 1) * 30));
  return Math.max(0, Math.min(100, Math.round(score)));
}
